import { describe, expect, it } from "vitest";
import type {
  DiagnosisCategory,
  ReasoningNodeDefinition,
} from "../src/domain/v2/types";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  compressedTypedCorrect,
  guidedSolvedAfterFormulaHint,
  handwritingRecognitionUncertain,
  kpNormalizedAttemptFixtures,
} from "../src/fixtures/v2/kpNormalizedAttempts";

const diagnosisOrder: readonly DiagnosisCategory[] = [
  "DATA_EXTRACTION",
  "TARGET_IDENTIFICATION",
  "STRATEGY",
  "FORMULA",
  "SUBSTITUTION",
  "ARITHMETIC",
  "UNIT",
  "PRECISION",
];

describe("V2 measurement contract gold artifacts", () => {
  it("keeps the reasoning graph referentially complete without requiring optional working", () => {
    const { nodes, pedagogicalOrder, acceptedStrategies } = kpGoldProblemV2.reasoningGraph;
    const nodeRecord: Readonly<Record<string, ReasoningNodeDefinition>> = nodes;

    expect(new Set(pedagogicalOrder)).toEqual(new Set(Object.keys(nodes)));
    for (const node of Object.values(nodes)) {
      for (const dependency of node.dependencies) {
        expect(nodeRecord[dependency]).toBeDefined();
        expect(pedagogicalOrder.indexOf(dependency)).toBeLessThan(
          pedagogicalOrder.indexOf(node.id),
        );
      }
    }

    for (const strategy of acceptedStrategies) {
      for (const nodeId of [...strategy.requiredNodeIds, ...strategy.optionalNodeIds]) {
        expect(nodeRecord[nodeId]).toBeDefined();
      }
    }

    const optionalWorking = acceptedStrategies[0].optionalNodeIds;
    expect(optionalWorking).toEqual([
      "total-moles",
      "mole-fraction-n2o4",
      "mole-fraction-no2",
      "partial-pressure-n2o4",
      "partial-pressure-no2",
    ]);
    expect(optionalWorking.every((nodeId) => !nodeRecord[nodeId].requiredForSolution)).toBe(
      true,
    );
  });

  it("provides unique fixtures with one expected evaluation per cognitive stage", () => {
    const ids = kpNormalizedAttemptFixtures.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const fixture of kpNormalizedAttemptFixtures) {
      expect(fixture.attempt.problemDefinitionId).toBe(kpGoldProblemV2.id);
      expect(fixture.attempt.problemDefinitionVersion).toBe(kpGoldProblemV2.version);
      expect(fixture.expected.stageEvaluations.map(({ category }) => category)).toEqual(
        diagnosisOrder,
      );

      const stepIds = new Set<string>(fixture.attempt.steps.map(({ id }) => id));
      const authoredFactIds = new Set<string>(
        kpGoldProblemV2.authoredFacts.map(({ id }) => id),
      );
      for (const fact of fixture.attempt.factsUsed) {
        expect(authoredFactIds.has(fact.factId)).toBe(true);
        expect(fact.evidenceStepIds.every((stepId) => stepIds.has(stepId))).toBe(true);
      }
      for (const evaluation of fixture.expected.stageEvaluations) {
        expect(evaluation.evidenceStepIds.every((stepId) => stepIds.has(stepId))).toBe(true);
      }

      const firstIncorrect = fixture.expected.stageEvaluations.find(
        ({ status }) => status === "INCORRECT",
      );
      expect(firstIncorrect?.category ?? null).toBe(fixture.expected.firstPedagogicalError);
      expect(firstIncorrect?.failureCode ?? null).toBe(fixture.expected.failureCode);
    }
  });

  it("accepts compressed evidence without claiming unobserved data-selection mastery", () => {
    expect(compressedTypedCorrect.attempt.steps).toHaveLength(1);
    expect(compressedTypedCorrect.expected.decision).toBe("SOLVED");
    expect(compressedTypedCorrect.expected.stageEvaluations[0]).toMatchObject({
      category: "DATA_EXTRACTION",
      status: "NOT_OBSERVED",
    });
  });

  it("gates diagnosis when recognition needs confirmation", () => {
    expect(handwritingRecognitionUncertain.attempt.recognitionIssues[0].status).toBe("OPEN");
    expect(handwritingRecognitionUncertain.expected).toMatchObject({
      decision: "RECOGNITION_UNCERTAIN",
      failureCode: null,
      firstPedagogicalError: null,
    });
    expect(
      handwritingRecognitionUncertain.expected.stageEvaluations.some(
        ({ status }) => status === "INCORRECT",
      ),
    ).toBe(false);
  });

  it("preserves formula-hint provenance in the mastery outcome", () => {
    expect(guidedSolvedAfterFormulaHint.attempt.assistanceEvents).toEqual([
      expect.objectContaining({
        stage: "FORMULA",
        level: 3,
        hintId: "FORMULA-KP-01",
        trigger: "LEARNER_REQUEST",
      }),
    ]);
    expect(guidedSolvedAfterFormulaHint.expected.masteryOutcome).toBe(
      "SOLVED_AFTER_FORMULA_HINT",
    );
    expect(
      guidedSolvedAfterFormulaHint.expected.stageEvaluations.find(
        ({ category }) => category === "FORMULA",
      )?.status,
    ).toBe("SUPPORTED_BY_HINT");
  });
});
