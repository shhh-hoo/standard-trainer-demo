import { describe, expect, it } from "vitest";
import manifest from "../src/published-components/manifest.json";
import kpSnapshot from "../src/published-components/kp-from-equilibrium-moles.json";
import massSnapshot from "../src/published-components/stoichiometric-product-mass.json";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import { compressedTypedCorrect } from "../src/fixtures/v2/kpNormalizedAttempts";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import { evaluatePublishedAttempt, getTargetAdapter, ImmutablePublishedComponentRegistry, publishedComponentRegistry, validatePublishedComponent, type NormalizedAttempt, type PublishedDiagnosticLearningComponent } from "../src/foundry-runtime";

const mass = publishedComponentRegistry.get("stoichiometric-product-mass")!;
const kp = publishedComponentRegistry.get("kp-from-equilibrium-moles")!;
const context = { traceId: "published-trace", submittedAt: "2026-07-15T10:00:00.000Z" };
const snapshotInputs = [
  { file: "kp-from-equilibrium-moles.json", snapshot: kpSnapshot },
  { file: "stoichiometric-product-mass.json", snapshot: massSnapshot },
];

function completeAttempt(component: PublishedDiagnosticLearningComponent, overrides: Partial<NormalizedAttempt> = {}): NormalizedAttempt {
  return {
    attemptId: "attempt-1", componentId: component.id, componentVersion: component.version,
    strategyId: component.reasoningGraph.acceptedStrategies[0].id,
    evidencedReasoningNodeIds: component.reasoningGraph.acceptedStrategies[0].nodeRequirements.filter((item) => item.requirement === "REQUIRED").map((item) => item.nodeId),
    substitutedFacts: {},
    ...(component.target.kind === "MASS" ? { stoichiometricRatio: 1 } : {}),
    finalAnswer: { value: component.target.expectedValue, unit: component.target.acceptedUnits[0], significantFigures: component.target.significantFigures },
    ...overrides,
  };
}

function failure(component: PublishedDiagnosticLearningComponent, overrides: Partial<NormalizedAttempt>) {
  const result = evaluatePublishedAttempt(component, completeAttempt(component, overrides), context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.trace;
}

describe("published component registry", () => {
  it("loads both Foundry snapshots by id and version", () => {
    expect(publishedComponentRegistry.list().map((item) => item.id)).toEqual(["kp-from-equilibrium-moles", "stoichiometric-product-mass"]);
    expect(publishedComponentRegistry.get(kp.id, kp.version)).toBe(kp);
    expect(publishedComponentRegistry.get("missing")).toBeNull();
  });

  it("rejects malformed and content-hash-mismatched snapshots", () => {
    expect(() => new ImmutablePublishedComponentRegistry(manifest, [{ file: "kp-from-equilibrium-moles.json", snapshot: { component: { id: "broken" } } }, snapshotInputs[1]])).toThrow(/rejected/i);
    const tampered = structuredClone(massSnapshot);
    tampered.component.presentation.prompt += " tampered";
    expect(() => new ImmutablePublishedComponentRegistry(manifest, [snapshotInputs[0], { file: "stoichiometric-product-mass.json", snapshot: tampered }])).toThrow(/CONTENT_HASH_MISMATCH/);
  });

  it("rejects duplicate manifest component identities", () => {
    const duplicateManifest = structuredClone(manifest);
    duplicateManifest.components.push(structuredClone(duplicateManifest.components[0]));
    expect(() => new ImmutablePublishedComponentRegistry(duplicateManifest, snapshotInputs)).toThrow(/DUPLICATE_MANIFEST_COMPONENT/);
  });

  it("rejects snapshots omitted by the manifest", () => {
    const incompleteManifest = structuredClone(manifest);
    incompleteManifest.components = incompleteManifest.components.filter((entry) => entry.id !== "stoichiometric-product-mass");
    expect(() => new ImmutablePublishedComponentRegistry(incompleteManifest, snapshotInputs)).toThrow(/UNMANIFESTED_SNAPSHOT/);
  });

  it("rejects a manifest file that points to the wrong component", () => {
    const swappedFiles = structuredClone(manifest);
    [swappedFiles.components[0].file, swappedFiles.components[1].file] = [swappedFiles.components[1].file, swappedFiles.components[0].file];
    expect(() => new ImmutablePublishedComponentRegistry(swappedFiles, snapshotInputs)).toThrow(/COMPONENT_FILE_MISMATCH/);
  });

  it("rejects duplicate manifest files and missing snapshots", () => {
    const duplicateFile = structuredClone(manifest);
    duplicateFile.components[1].file = duplicateFile.components[0].file;
    expect(() => new ImmutablePublishedComponentRegistry(duplicateFile, snapshotInputs)).toThrow(/DUPLICATE_MANIFEST_FILE/);
    expect(() => new ImmutablePublishedComponentRegistry(manifest, [snapshotInputs[0]])).toThrow(/MISSING_SNAPSHOT/);
  });
});

describe("published component validation", () => {
  it("fails closed with structured schema issues for deeply malformed snapshots", () => {
    const malformedValues: unknown[] = [
      { ...structuredClone(massSnapshot), component: { ...structuredClone(massSnapshot.component), reasoningGraph: {} } },
      { ...structuredClone(massSnapshot), component: { ...structuredClone(massSnapshot.component), reasoningGraph: { ...structuredClone(massSnapshot.component.reasoningGraph), nodes: null } } },
      { ...structuredClone(massSnapshot), component: { ...structuredClone(massSnapshot.component), formulaDefinitions: [{ ...structuredClone(massSnapshot.component.formulaDefinitions[0]), expression: {} }] } },
      { ...structuredClone(massSnapshot), component: { ...structuredClone(massSnapshot.component), reasoningGraph: { ...structuredClone(massSnapshot.component.reasoningGraph), acceptedStrategies: [null] } } },
      { ...structuredClone(massSnapshot), component: { ...structuredClone(massSnapshot.component), publication: { ...structuredClone(massSnapshot.component.publication), contentHash: 42 } } },
      { ...structuredClone(massSnapshot), component: { ...structuredClone(massSnapshot.component), authoredFacts: [null] } },
    ];

    for (const value of malformedValues) {
      expect(() => validatePublishedComponent(value)).not.toThrow();
      const result = validatePublishedComponent(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0]).toMatchObject({ code: expect.stringMatching(/^SCHEMA_/), path: expect.any(String) });
    }
  });
});

describe("target adapter registry", () => {
  it("preserves Kp happy-path decision parity across legacy and simplified published contracts", () => {
    const legacy = diagnoseNormalizedAttempt(kpGoldProblemV2, compressedTypedCorrect.attempt, { traceId: "legacy", submittedAt: context.submittedAt, interpreter: { kind: "TYPED_WORKING_MOCK", adapterVersion: "regression" } });
    const migrated = evaluatePublishedAttempt(kp, completeAttempt(kp), context);
    expect(legacy.ok && legacy.trace.decision).toBe("SOLVED");
    expect(migrated.ok && migrated.trace.decision).toBe("SOLVED");
    expect(migrated.ok && migrated.trace.componentContentHash).toBe(kp.publication.contentHash);
    expect(kp.migration).toMatchObject({ fidelity: "SIMPLIFIED", sourceContractVersion: "2.0.0-draft.2" });
    expect(kp.migration?.omittedCapabilities).toEqual(expect.arrayContaining(["two accepted Kp strategies", "recognition gating", "assistance provenance and support outcomes"]));
  });

  it("solves the correct mass attempt", () => {
    expect(failure(mass, {}).decision).toBe("SOLVED");
  });

  it("diagnoses wrong ratio, arithmetic, unit and precision", () => {
    expect(failure(mass, { stoichiometricRatio: 0.5 }).failureCode).toBe("WRONG_STOICHIOMETRIC_RATIO");
    expect(failure(mass, { arithmeticWorkingValue: 7.9 }).failureCode).toBe("ARITHMETIC_ERROR");
    expect(failure(mass, { finalAnswer: { value: 8, unit: "kg", significantFigures: 3 } }).failureCode).toBe("UNIT_ERROR");
    expect(failure(mass, { finalAnswer: { value: 8, unit: "g", significantFigures: 2 } }).failureCode).toBe("SIGNIFICANT_FIGURES_ERROR");
  });

  it("fails closed when no verified target adapter exists", () => {
    const unsupported = { ...structuredClone(mass), target: { ...mass.target, kind: "PH" as const } };
    expect(getTargetAdapter("PH")).toBeNull();
    expect(evaluatePublishedAttempt(unsupported, completeAttempt(unsupported), context)).toMatchObject({ ok: false, kind: "UNSUPPORTED_TARGET" });
  });
});
