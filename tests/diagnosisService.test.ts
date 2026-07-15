import { describe, expect, it } from "vitest";
import {
  StaticBundledRegistryProvider,
  loadMergedRegistry,
  runLearnerDiagnosis,
  type NormalizedAttempt,
} from "../src/foundry-runtime";

const TEST_FIXTURE = "TEST_FIXTURE" as const;
const problemContext = { prompt: "Magnesium reacts with excess oxygen. Calculate the mass of MgO from 4.80 g Mg.", reactionEquation: "2Mg + O2 -> 2MgO", givenValues: [{ label: "mass of Mg", value: 4.8, unit: "g" }, { label: "Ar(Mg)", value: 24, unit: "1" }, { label: "Mr(MgO)", value: 40, unit: "1" }], targetQuantity: "mass of MgO", answerRequirement: "3 significant figures" };

describe("Trainer Diagnosis API core", () => {
  it("runs the validated MASS adapter and returns a version-pinned diagnosis", async () => {
    expect(TEST_FIXTURE).toBe("TEST_FIXTURE");
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    const component = registry.get("stoichiometric-product-mass")!;
    const attempt: NormalizedAttempt = {
      attemptId: "test-attempt-ratio",
      componentId: component.id,
      componentVersion: component.version,
      strategyId: component.reasoningGraph.acceptedStrategies[0]!.id,
      evidencedReasoningNodeIds: component.reasoningGraph.acceptedStrategies[0]!.nodeRequirements
        .filter((item) => item.requirement === "REQUIRED")
        .map((item) => item.nodeId),
      substitutedFacts: {},
      stoichiometricRatio: 0.5,
      finalAnswer: { value: 4, unit: "g", significantFigures: 3 },
    };

    const result = await runLearnerDiagnosis(
      { componentId: component.id, problemContext, attempt },
      { registry, now: () => "2026-07-16T10:00:00.000Z", createId: () => "trainer-trace-test" },
    );

    expect(result).toMatchObject({
      componentId: "stoichiometric-product-mass",
      componentVersion: component.version,
      diagnosis: {
        decision: "STUDENT_ERROR",
        firstPedagogicalIssue: "FORMULA",
        failureCode: "WRONG_STOICHIOMETRIC_RATIO",
      },
      traceId: "trainer-trace-test",
    });
    expect(result.recommendedSupport).toMatch(/coefficients/i);
    expect(result.diagnosis.evidence).not.toHaveLength(0);
  });

  it("fails closed when the requested component is unavailable", async () => {
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    await expect(runLearnerDiagnosis({ componentId: "missing", problemContext, attempt: {} }, { registry }))
      .rejects.toThrow("COMPONENT_NOT_FOUND");
  });

  it("rejects learner working without original problem context", async () => {
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    await expect(runLearnerDiagnosis({ componentId: "stoichiometric-product-mass", problemContext: { prompt: "", reactionEquation: "", givenValues: [], targetQuantity: "" }, attempt: {} }, { registry })).rejects.toThrow("INCOMPLETE_PROBLEM_CONTEXT");
  });
});
