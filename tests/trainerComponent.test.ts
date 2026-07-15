import { describe, expect, it } from "vitest";
import { chemistryCalculationTrainer } from "../src/component/chemistryCalculationTrainer";
import { compressedTypedCorrect } from "../src/fixtures/v2/kpNormalizedAttempts";
import { handwritingRecognitionUncertain } from "../src/fixtures/v2/kpNormalizedAttempts";
import type { StudentStepInput } from "../src/domain/types";

function canonicalLegacySteps(): Record<string, StudentStepInput> {
  return {
    totalMoles: { numericValue: 1, unit: "mol" },
    moleFractionN2O4: { numericValue: 0.4 },
    moleFractionNO2: { numericValue: 0.6 },
    partialPressureN2O4: { numericValue: 200, unit: "kPa" },
    partialPressureNO2: { numericValue: 300, unit: "kPa" },
    kpExpression: { expression: "p(NO2)^2 / p(N2O4)" },
    kpResult: { numericValue: 450, unit: "kPa", significantFigures: 3 },
  };
}

describe("Chemistry Calculation Trainer component boundary", () => {
  it("publishes an honest manifest and exact-matches the supported normalized request", () => {
    expect(chemistryCalculationTrainer.manifest).toMatchObject({
      componentId: "chemistry-calculation-trainer",
      componentVersion: "0.2.0",
      componentType: "trainer",
      domain: {
        curriculum: "CAIE 9701 Chemistry",
        topic: "Equilibrium",
        supportedProblemDefinitions: [
          "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        ],
      },
      supportedTasks: ["diagnose-normalized-calculation-attempt"],
      guarantees: {
        diagnosis: "deterministic-for-supported-problem",
        arithmetic: "deterministic",
        problemCoverage: "single-authored-problem",
      },
    });
    expect(chemistryCalculationTrainer.manifest.unsupported).toContain("buffer-calculations");

    expect(
      chemistryCalculationTrainer.preflight({
        task: "diagnose-normalized-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "normalized-attempt",
      }),
    ).toEqual({
      coverage: "EXACT_MATCH",
      componentId: "chemistry-calculation-trainer",
      fitScore: 1,
      matchedCapabilities: [
        "supported-problem-definition",
        "diagnose-normalized-calculation-attempt",
        "normalized-attempt",
      ],
      missingCapabilities: [],
      limitations: ["single-authored-problem", "deterministic-normalized-input-only"],
      recommendedAction: "INVOKE_COMPONENT",
    });
  });

  it("partial-matches supported-problem requests that still require an interpreter", () => {
    for (const [inputKind, missingCapability] of [
      ["handwriting-image", "multimodal-interpreter"],
      ["natural-language-working", "free-text-interpreter"],
    ] as const) {
      expect(
        chemistryCalculationTrainer.preflight({
          task: "diagnose-normalized-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind,
        }),
        inputKind,
      ).toEqual({
        coverage: "PARTIAL_MATCH",
        componentId: "chemistry-calculation-trainer",
        fitScore: 0.65,
        matchedCapabilities: [
          "supported-problem-definition",
          "diagnose-normalized-calculation-attempt",
          "deterministic-diagnosis",
        ],
        missingCapabilities: [missingCapability, "normalized-attempt"],
        limitations: [
          "single-authored-problem",
          "interpreter-not-included",
          "confirmation-required-before-invocation",
        ],
        recommendedAction: "REQUIRE_INTERPRETER",
      });
    }
  });

  it("rejects other problem definitions and only recommends Foundry-level fallback actions", () => {
    expect(
      chemistryCalculationTrainer.preflight({
        task: "diagnose-normalized-calculation-attempt",
        problemDefinition: "ANOTHER_KP_FROM_EQUILIBRIUM_MOLES@1.0.0",
        inputKind: "normalized-attempt",
        demandSignal: "LOW_RISK_ONE_OFF",
      }),
    ).toEqual({
      coverage: "UNSUPPORTED",
      componentId: "chemistry-calculation-trainer",
      fitScore: 0.2,
      matchedCapabilities: ["diagnose-normalized-calculation-attempt"],
      missingCapabilities: ["supported-problem-definition"],
      limitations: ["single-authored-problem", "requested-problem-not-supported"],
      recommendedAction: "USE_TEMPORARY_SUPPORT",
    });

    expect(
      chemistryCalculationTrainer.preflight({
        task: "diagnose-normalized-calculation-attempt",
        problemDefinition: "BUFFER_PH_CALCULATION@1.0.0",
        inputKind: "natural-language-working",
        demandSignal: "REPEATED_HIGH_VALUE",
      }),
    ).toMatchObject({
      coverage: "UNSUPPORTED",
      fitScore: 0.2,
      missingCapabilities: ["supported-problem-definition"],
      recommendedAction: "RECORD_CAPABILITY_GAP",
    });
  });

  it("invokes the deterministic core for an exact normalized attempt", () => {
    const envelope = chemistryCalculationTrainer.invoke({
      request: {
        task: "diagnose-normalized-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "normalized-attempt",
      },
      input: {
        kind: "normalized-attempt",
        attempt: compressedTypedCorrect.attempt,
      },
      context: {
        traceId: "component-normalized-trace",
        submittedAt: "2026-07-15T10:00:00.000Z",
        interpreter: {
          kind: "TYPED_WORKING_MOCK",
          adapterVersion: "component-test-v1",
        },
      },
    });

    expect(envelope).toMatchObject({
      componentId: "chemistry-calculation-trainer",
      componentVersion: "0.2.0",
      coverage: "EXACT_MATCH",
      status: "COMPLETED",
      limitations: ["single-authored-problem", "deterministic-normalized-input-only"],
      result: {
        decision: "SOLVED",
        problemDefinitionId: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD",
        problemDefinitionVersion: "2.0.0-gold.2",
      },
    });
  });

  it("adapts and invokes the legacy seven-step structured input", () => {
    const envelope = chemistryCalculationTrainer.invoke({
      request: {
        task: "diagnose-normalized-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "legacy-seven-step-structured-input",
      },
      input: {
        kind: "legacy-seven-step-structured-input",
        submission: {
          attemptId: "component-legacy-attempt",
          submittedAt: "2026-07-15T10:01:00.000Z",
          steps: canonicalLegacySteps(),
        },
      },
      context: {
        traceId: "component-legacy-trace",
        submittedAt: "2026-07-15T10:01:00.000Z",
        interpreter: { kind: "STRUCTURED_ADAPTER", adapterVersion: "caller-value-ignored" },
      },
    });

    expect(envelope).toMatchObject({
      coverage: "EXACT_MATCH",
      status: "COMPLETED",
      result: {
        decision: "SOLVED",
        attemptSupportOutcome: "SOLVED_USING_FULL_SCAFFOLD",
        interpreter: {
          kind: "STRUCTURED_ADAPTER",
          adapterVersion: "v1-structured-v1",
        },
      },
    });
  });

  it("invokes all four explicit mock scenarios through the component envelope", () => {
    const expected = {
      COMPRESSED_CORRECT: ["SOLVED", null],
      EXPLANATION_ONLY: ["INCOMPLETE_EVIDENCE", null],
      INVERTED_FORMULA: ["STUDENT_ERROR", "INVERTED_RELATION"],
      WRONG_DEPENDENCY: ["STUDENT_ERROR", "WRONG_DEPENDENCY_USED"],
    } as const;

    for (const [scenario, [decision, failureCode]] of Object.entries(expected)) {
      const envelope = chemistryCalculationTrainer.invoke({
        request: {
          task: "diagnose-normalized-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind: "explicit-mock-scenario",
        },
        input: {
          kind: "explicit-mock-scenario",
          scenario: scenario as keyof typeof expected,
          attemptId: `component-mock-${scenario.toLowerCase()}`,
          submittedAt: "2026-07-15T10:02:00.000Z",
        },
        context: {
          traceId: `component-mock-trace-${scenario.toLowerCase()}`,
          submittedAt: "2026-07-15T10:02:00.000Z",
          interpreter: { kind: "TYPED_WORKING_MOCK", adapterVersion: "caller-value-ignored" },
        },
      });

      expect(envelope, scenario).toMatchObject({
        coverage: "EXACT_MATCH",
        status: "COMPLETED",
        result: {
          decision,
          failureCode,
          interpreter: {
            kind: "TYPED_WORKING_MOCK",
            adapterVersion: "typed-working-mock-v1",
          },
        },
      });
    }
  });

  it("returns explicit uncertain, invalid, and unsupported envelope statuses", () => {
    const request = {
      task: "diagnose-normalized-calculation-attempt",
      problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
      inputKind: "normalized-attempt",
    } as const;
    const context = {
      traceId: "component-status-trace",
      submittedAt: "2026-07-15T10:03:00.000Z",
      interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "status-test-v1" },
    };

    expect(
      chemistryCalculationTrainer.invoke({
        request,
        input: {
          kind: "normalized-attempt",
          attempt: handwritingRecognitionUncertain.attempt,
        },
        context,
      }),
    ).toMatchObject({ status: "RECOGNITION_UNCERTAIN", coverage: "EXACT_MATCH" });

    const invalidAttempt = structuredClone(compressedTypedCorrect.attempt);
    Object.assign(invalidAttempt, { problemDefinitionVersion: "unsupported-version" });
    expect(
      chemistryCalculationTrainer.invoke({
        request,
        input: { kind: "normalized-attempt", attempt: invalidAttempt },
        context,
      }),
    ).toMatchObject({
      status: "INVALID_INPUT",
      coverage: "EXACT_MATCH",
      issues: [expect.objectContaining({ code: "WRONG_PROBLEM_VERSION" })],
    });

    expect(
      chemistryCalculationTrainer.invoke({
        request,
        input: {
          kind: "explicit-mock-scenario",
          scenario: "COMPRESSED_CORRECT",
          attemptId: "mismatched-component-attempt",
          submittedAt: "2026-07-15T10:03:00.000Z",
        },
        context,
      }),
    ).toMatchObject({
      status: "INVALID_INPUT",
      coverage: "EXACT_MATCH",
      issues: [expect.objectContaining({ code: "INVOCATION_INPUT_MISMATCH" })],
    });

    expect(
      chemistryCalculationTrainer.invoke({
        request: {
          ...request,
          problemDefinition: "BUFFER_PH_CALCULATION@1.0.0",
          demandSignal: "REPEATED_HIGH_VALUE",
        },
        input: { kind: "normalized-attempt", attempt: compressedTypedCorrect.attempt },
        context,
      }),
    ).toMatchObject({ status: "UNSUPPORTED", coverage: "UNSUPPORTED" });
  });
});
