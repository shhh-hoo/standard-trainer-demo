import { describe, expect, it } from "vitest";
import type {
  AcceptedStrategyDefinition,
  AssistanceEvent,
  DiagnosisCategory,
  ExpressionAst,
  NormalizedAttempt,
  NormalizedAttemptFixture,
  ReasoningEvidenceKind,
  ReasoningNodeDefinition,
  RecognitionEvidence,
  RecognitionGateDecision,
  VariableReference,
} from "../src/domain/v2/types";
import { V2_CONTRACT_VERSION } from "../src/domain/v2/types";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  arithmeticErrorAfterCorrectSubstitution,
  completeHandwritingCorrect,
  compressedTypedCorrect,
  guidedNotSolvedAfterFullScaffold,
  guidedSolvedAfterFormulaHint,
  handwritingBelowThresholdAbstain,
  handwritingRecognitionUncertain,
  kpGoldFixtureMetadata,
  kpNormalizedAttemptFixtures,
  wrongDependencyIncorrect,
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

function strategySatisfied(
  strategy: AcceptedStrategyDefinition,
  evidenceByNode: Readonly<Record<string, ReasoningEvidenceKind | undefined>>,
): boolean {
  return strategy.nodeRequirements.every((node) => {
    if (node.requirement === "OPTIONAL") {
      return true;
    }
    const supplied = evidenceByNode[node.nodeId];
    return supplied !== undefined && node.allowedEvidenceKinds.includes(supplied);
  });
}

function referencesIn(expression: ExpressionAst): readonly VariableReference[] {
  switch (expression.kind) {
    case "NUMBER":
      return [];
    case "VARIABLE":
      return [expression.reference];
    case "BINARY":
      return [...referencesIn(expression.left), ...referencesIn(expression.right)];
    case "FUNCTION":
      return expression.arguments.flatMap(referencesIn);
  }
}

function aggregateRecognitionGate(attempt: NormalizedAttempt): RecognitionGateDecision {
  const recognitionStates = [
    ...attempt.steps.map(({ recognition }) => recognition.status),
    ...attempt.recognitionIssues.flatMap((issue) =>
      issue.scope === "STEP" ? [] : [issue.recognition.status],
    ),
  ];
  if (recognitionStates.includes("ABSTAINED")) {
    return "ABSTAINED";
  }
  if (recognitionStates.includes("REQUIRES_CONFIRMATION")) {
    return "REQUIRES_CONFIRMATION";
  }
  return "PASSED";
}

function recomputeAttempt(attempt: NormalizedAttempt): ReadonlyMap<string, number> {
  const authoredValues = new Map<string, number>(
    kpGoldProblemV2.authoredFacts
      .filter((fact): fact is typeof fact & { readonly value: number } =>
        typeof fact.value === "number",
      )
      .map(({ id, value }) => [id, value]),
  );
  const declaredStepValues = new Map<string, number>();
  const recomputed = new Map<string, number>();

  const evaluate = (expression: ExpressionAst): number => {
    switch (expression.kind) {
      case "NUMBER":
        return expression.value;
      case "VARIABLE": {
        const reference = expression.reference;
        if (reference.source === "AUTHORED_FACT") {
          const value = authoredValues.get(reference.factId);
          if (value === undefined) throw new Error(`Unresolved fact ${reference.factId}`);
          return value;
        }
        if (reference.source === "NORMALIZED_STEP_RESULT") {
          const value = declaredStepValues.get(reference.stepId);
          if (value === undefined) throw new Error(`Unresolved step ${reference.stepId}`);
          return value;
        }
        throw new Error(`Reasoning quantity ${reference.reasoningNodeId} is not a value source`);
      }
      case "BINARY": {
        const left = evaluate(expression.left);
        const right = evaluate(expression.right);
        switch (expression.operator) {
          case "ADD":
            return left + right;
          case "SUBTRACT":
            return left - right;
          case "MULTIPLY":
            return left * right;
          case "DIVIDE":
            return left / right;
          case "POWER":
            return left ** right;
        }
      }
      case "FUNCTION":
        return expression.arguments.reduce((sum, argument) => sum + evaluate(argument), 0);
    }
  };

  const stepById = new Map(attempt.steps.map((step) => [step.id, step]));
  for (const revision of [...attempt.revisions].sort((a, b) => a.sequence - b.sequence)) {
    for (const stepId of revision.stepIds) {
      const step = stepById.get(stepId);
      if (!step?.calculation) continue;
      recomputed.set(stepId, evaluate(step.calculation.expression));
      if (step.calculation.declaredResult) {
        declaredStepValues.set(stepId, step.calculation.declaredResult.value);
      }
    }
  }
  return recomputed;
}

describe("V2 measurement contract gold artifacts", () => {
  it("uses one graph authority and keeps every dependency referentially complete", () => {
    const { nodes, pedagogicalOrder, acceptedStrategies } = kpGoldProblemV2.reasoningGraph;
    const nodeRecord: Readonly<Record<string, ReasoningNodeDefinition>> = nodes;

    expect(new Set(pedagogicalOrder)).toEqual(new Set(Object.keys(nodes)));
    for (const node of Object.values(nodes)) {
      expect(node).not.toHaveProperty("requiredForSolution");
      expect(node.independentStageEvidenceKinds).not.toContain("INFERRED");
      for (const dependency of node.dependencies) {
        expect(nodeRecord[dependency]).toBeDefined();
        expect(pedagogicalOrder.indexOf(dependency)).toBeLessThan(
          pedagogicalOrder.indexOf(node.id),
        );
      }
    }

    for (const strategy of acceptedStrategies) {
      for (const requirement of strategy.nodeRequirements) {
        expect(nodeRecord[requirement.nodeId]).toBeDefined();
        expect(
          requirement.allowedEvidenceKinds.every((kind) =>
            nodeRecord[requirement.nodeId].solutionEvidenceKinds.includes(kind),
          ),
        ).toBe(true);
      }
    }
  });

  it("makes explicit and compressed strategies structurally and behaviorally distinct", () => {
    const [explicit, compressed] = kpGoldProblemV2.reasoningGraph.acceptedStrategies;
    expect(explicit.nodeRequirements).not.toEqual(compressed.nodeRequirements);

    const explicitEvidence = Object.fromEntries(
      explicit.nodeRequirements.map(({ nodeId, allowedEvidenceKinds }) => [
        nodeId,
        allowedEvidenceKinds[0],
      ]),
    );
    const compressedEvidence = Object.fromEntries(
      compressed.nodeRequirements.map(({ nodeId, allowedEvidenceKinds }) => [
        nodeId,
        allowedEvidenceKinds[0],
      ]),
    );

    expect(strategySatisfied(explicit, explicitEvidence)).toBe(true);
    expect(strategySatisfied(compressed, compressedEvidence)).toBe(true);
    expect(strategySatisfied(explicit, compressedEvidence)).toBe(false);
    expect(strategySatisfied(compressed, explicitEvidence)).toBe(false);

    const missingPartialPressure = { ...compressedEvidence };
    delete missingPartialPressure["partial-pressure-no2"];
    expect(strategySatisfied(compressed, missingPartialPressure)).toBe(false);
  });

  it("covers an independently testable incorrect path for every cognitive category", () => {
    const incorrectCategories = new Set(
      kpNormalizedAttemptFixtures.flatMap((fixture) =>
        fixture.expected.stageEvaluations
          .filter(({ status }) => status === "INCORRECT")
          .map(({ category }) => category),
      ),
    );
    expect(incorrectCategories).toEqual(new Set(diagnosisOrder));
  });

  it("backs every substitution and arithmetic judgement with structured calculation evidence", () => {
    const judgedStatuses = new Set(["CORRECT", "INCORRECT", "DOWNSTREAM_AFFECTED"]);

    for (const fixtureValue of kpNormalizedAttemptFixtures) {
      const fixture: NormalizedAttemptFixture = fixtureValue;
      const stepById = new Map(fixture.attempt.steps.map((step) => [step.id, step]));
      for (const evaluation of fixture.expected.stageEvaluations) {
        if (
          !["SUBSTITUTION", "ARITHMETIC"].includes(evaluation.category) ||
          !judgedStatuses.has(evaluation.status)
        ) {
          continue;
        }
        expect(evaluation.evidenceStepIds.length, fixture.id).toBeGreaterThan(0);
        expect(
          evaluation.evidenceStepIds.some((stepId) => stepById.get(stepId)?.calculation),
          fixture.id,
        ).toBe(true);
      }
    }
  });

  it("resolves every authored fact, prior step, reasoning quantity, revision, and issue reference", () => {
    const factIds = new Set<string>(kpGoldProblemV2.authoredFacts.map(({ id }) => id));
    const nodeIds = new Set<string>(Object.keys(kpGoldProblemV2.reasoningGraph.nodes));

    for (const fixtureValue of kpNormalizedAttemptFixtures) {
      const fixture: NormalizedAttemptFixture = fixtureValue;
      const stepIds = new Set<string>(fixture.attempt.steps.map(({ id }) => id));
      const revisionIds = new Set<string>(fixture.attempt.revisions.map(({ id }) => id));
      const orderedStepIds = [...fixture.attempt.revisions]
        .sort((a, b) => a.sequence - b.sequence)
        .flatMap(({ stepIds: revisionStepIds }) => revisionStepIds);
      const stepOrder = new Map(orderedStepIds.map((stepId, index) => [stepId, index]));
      expect(new Set(orderedStepIds).size, fixture.id).toBe(fixture.attempt.steps.length);

      for (const factUse of fixture.attempt.factsUsed) {
        expect(factIds.has(factUse.factId), fixture.id).toBe(true);
        expect(factUse.evidenceStepIds.every((stepId) => stepIds.has(stepId)), fixture.id).toBe(
          true,
        );
      }
      for (const step of fixture.attempt.steps) {
        expect(revisionIds.has(step.revisionId), fixture.id).toBe(true);
        const expressions = [step.formulaAst, step.calculation?.expression].filter(
          (expression): expression is ExpressionAst => expression !== undefined,
        );
        const references = expressions.flatMap(referencesIn);
        if (step.calculation) {
          references.push(step.calculation.target);
        }
        for (const reference of references) {
          if (reference.source === "AUTHORED_FACT") {
            expect(factIds.has(reference.factId), fixture.id).toBe(true);
          } else if (reference.source === "NORMALIZED_STEP_RESULT") {
            expect(stepIds.has(reference.stepId), fixture.id).toBe(true);
            expect(stepOrder.get(reference.stepId), fixture.id).toBeLessThan(
              stepOrder.get(step.id) ?? Number.POSITIVE_INFINITY,
            );
          } else {
            expect(nodeIds.has(reference.reasoningNodeId), fixture.id).toBe(true);
          }
        }
      }
      for (const revision of fixture.attempt.revisions) {
        expect(revision.stepIds.every((stepId) => stepIds.has(stepId)), fixture.id).toBe(true);
      }
      for (const step of fixture.attempt.steps) {
        expect(
          fixture.attempt.revisions.filter((revision) => revision.stepIds.includes(step.id)),
          fixture.id,
        ).toHaveLength(1);
      }
      for (const issue of fixture.attempt.recognitionIssues) {
        if (issue.scope === "STEP") {
          expect(stepIds.has(issue.stepId), fixture.id).toBe(true);
        }
      }
    }
  });

  it("requires modality-correct source evidence for every normalized step", () => {
    for (const fixtureValue of kpNormalizedAttemptFixtures) {
      const fixture: NormalizedAttemptFixture = fixtureValue;
      const artifactById = new Map(
        fixture.attempt.artifacts.map((artifact) => [artifact.id, artifact]),
      );
      for (const step of fixture.attempt.steps) {
        const artifact = artifactById.get(step.source.artifactId);
        expect(artifact, fixture.id).toBeDefined();
        expect(artifact?.modality, fixture.id).toBe(step.source.modality);
        if (
          step.source.modality === "HANDWRITING_IMAGE" ||
          step.source.modality === "DIGITAL_INK"
        ) {
          expect(step.source.page, fixture.id).toBeGreaterThan(0);
          expect(step.source.boundingBox.width, fixture.id).toBeGreaterThan(0);
          expect(step.source.boundingBox.height, fixture.id).toBeGreaterThan(0);
        } else {
          expect(step.source.textSpan.length, fixture.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it("makes recognition states mutually exclusive and separates the aggregate gate", () => {
    const confirmed: RecognitionEvidence = {
      status: "STUDENT_CONFIRMED",
      confidence: 0.8,
      selectedTranscription: "0.400",
      candidates: [{ transcription: "0.400", confidence: 0.8 }],
    };
    const gate: RecognitionGateDecision = "PASSED";

    // @ts-expect-error A confirmed state must include the selected transcription.
    const contradictoryRecognition: RecognitionEvidence = {
      status: "STUDENT_CONFIRMED",
      confidence: 0.8,
      candidates: [],
    };
    // @ts-expect-error Step-level recognition states cannot be used as trace-level gates.
    const contradictoryGate: RecognitionGateDecision = "AUTO_ACCEPTED";

    expect(confirmed.status).toBe("STUDENT_CONFIRMED");
    expect(gate).toBe("PASSED");
    expect(contradictoryRecognition.status).toBe("STUDENT_CONFIRMED");
    expect(contradictoryGate).toBe("AUTO_ACCEPTED");

    for (const fixtureValue of kpNormalizedAttemptFixtures) {
      const fixture: NormalizedAttemptFixture = fixtureValue;
      expect(aggregateRecognitionGate(fixture.attempt), fixture.id).toBe(
        fixture.expected.recognitionGateDecision,
      );
      const stepById = new Map(fixture.attempt.steps.map((step) => [step.id, step]));
      for (const issue of fixture.attempt.recognitionIssues) {
        if (issue.scope !== "STEP") {
          continue;
        }
        const recognition = stepById.get(issue.stepId)?.recognition;
        expect(recognition?.status, fixture.id).not.toBe("AUTO_ACCEPTED");
        if (recognition?.status === "STUDENT_CONFIRMED") {
          expect(
            recognition.candidates.some(
              ({ transcription }) => transcription === recognition.selectedTranscription,
            ),
            fixture.id,
          ).toBe(true);
        }
      }
    }
  });

  it("records ordered revisions and proves assistance precedes supported work", () => {
    for (const fixture of [guidedSolvedAfterFormulaHint, guidedNotSolvedAfterFullScaffold]) {
      const eventById = new Map<string, AssistanceEvent>(
        fixture.attempt.assistanceEvents.map((event) => [event.id, event]),
      );
      const revisionById = new Map(
        fixture.attempt.revisions.map((revision) => [revision.id, revision]),
      );
      const hintById = new Map(kpGoldProblemV2.hintPolicy.hints.map((hint) => [hint.id, hint]));
      expect(new Set([...eventById.keys()]).size).toBe(fixture.attempt.assistanceEvents.length);

      const globalSequences = [
        ...fixture.attempt.revisions.map(({ sequence }) => sequence),
        ...fixture.attempt.assistanceEvents.map(({ sequence }) => sequence),
      ];
      expect(new Set(globalSequences).size, fixture.id).toBe(globalSequences.length);

      for (const revision of fixture.attempt.revisions) {
        for (const eventId of revision.precededByAssistanceEventIds) {
          const event = eventById.get(eventId);
          expect(event, fixture.id).toBeDefined();
          expect(event?.sequence, fixture.id).toBeLessThan(revision.sequence);
        }
      }
      for (const event of fixture.attempt.assistanceEvents) {
        const hint = hintById.get(event.hintId);
        expect(hint, fixture.id).toBeDefined();
        expect(event.revealedReasoningNodeIds, fixture.id).toEqual(
          hint?.revealedReasoningNodeIds,
        );
        expect(event.revealedContentIds, fixture.id).toEqual(hint?.revealedContentIds);
      }
      for (const step of fixture.attempt.steps) {
        expect(revisionById.get(step.revisionId)?.stepIds, fixture.id).toContain(step.id);
      }
    }

    const formulaEvent = guidedSolvedAfterFormulaHint.attempt.assistanceEvents[0];
    const supportedRevision = guidedSolvedAfterFormulaHint.attempt.revisions.find((revision) =>
      (revision.precededByAssistanceEventIds as readonly string[]).includes(formulaEvent.id),
    );
    expect(formulaEvent.revealedReasoningNodeIds).toContain("construct-kp-expression");
    expect(supportedRevision?.stepIds).toContain("after-hint");
  });

  it("uses attempt support outcomes without single-item mastery identifiers", () => {
    for (const fixture of kpNormalizedAttemptFixtures) {
      expect(fixture.expected).toHaveProperty("attemptSupportOutcome");
      expect(fixture.expected).not.toHaveProperty("masteryOutcome");
    }
    expect(guidedSolvedAfterFormulaHint.expected.attemptSupportOutcome).toBe(
      "SOLVED_AFTER_FORMULA_HINT",
    );
  });

  it("accepts compressed calculation evidence without claiming data-selection capability", () => {
    const working = compressedTypedCorrect.attempt.steps[0];
    expect(compressedTypedCorrect.attempt.steps).toHaveLength(1);
    expect(working.formulaAst).toBeDefined();
    expect(working.calculation?.expression).toBeDefined();
    expect(compressedTypedCorrect.expected.decision).toBe("SOLVED");
    expect(compressedTypedCorrect.expected.stageEvaluations[0]).toMatchObject({
      category: "DATA_EXTRACTION",
      status: "NOT_OBSERVED",
    });
  });

  it("recomputes explicit, compressed, wrong-dependency, and arithmetic-error evidence without raw text", () => {
    const explicit = recomputeAttempt(completeHandwritingCorrect.attempt);
    expect(explicit.get("total")).toBeCloseTo(1);
    expect(explicit.get("pp-n2o4")).toBeCloseTo(200);
    expect(explicit.get("pp-no2")).toBeCloseTo(300);
    expect(explicit.get("final")).toBeCloseTo(450);

    expect(recomputeAttempt(compressedTypedCorrect.attempt).get("working")).toBeCloseTo(450);
    expect(
      recomputeAttempt(wrongDependencyIncorrect.attempt).get("wrong-substitution"),
    ).toBeCloseTo(0.9);
    expect(
      recomputeAttempt(arithmeticErrorAfterCorrectSubstitution.attempt).get("arithmetic-step"),
    ).toBeCloseTo(450);
    expect(
      arithmeticErrorAfterCorrectSubstitution.attempt.steps[0].calculation?.declaredResult
        ?.value,
    ).toBe(400);
  });

  it("ties every final significant-figure claim to unambiguous source text", () => {
    for (const fixtureValue of kpNormalizedAttemptFixtures) {
      const fixture: NormalizedAttemptFixture = fixtureValue;
      const finalAnswer = fixture.attempt.finalAnswer;
      if (finalAnswer?.significantFigures === undefined) {
        continue;
      }
      expect(finalAnswer.raw, fixture.id).toBeTruthy();
      const matchingStep = fixture.attempt.steps.find(
        (step) =>
          step.calculation?.declaredResult?.value === finalAnswer.value &&
          step.calculation.declaredResult.raw === finalAnswer.raw,
      );
      expect(matchingStep, fixture.id).toBeDefined();
      expect(matchingStep?.rawTranscription, fixture.id).toContain(finalAnswer.raw);
    }
  });

  it("keeps first pedagogical error aligned with the first incorrect stage", () => {
    for (const fixtureValue of kpNormalizedAttemptFixtures) {
      const fixture: NormalizedAttemptFixture = fixtureValue;
      expect(fixture.expected.stageEvaluations.map(({ category }) => category)).toEqual(
        diagnosisOrder,
      );
      const firstIncorrect = fixture.expected.stageEvaluations.find(
        ({ status }) => status === "INCORRECT",
      );
      expect(firstIncorrect?.category ?? null, fixture.id).toBe(
        fixture.expected.firstPedagogicalError,
      );
      expect(firstIncorrect?.failureCode ?? null, fixture.id).toBe(
        fixture.expected.failureCode,
      );
    }
  });

  it("never turns a recognition-gated attempt into a student-error decision", () => {
    const gated = kpNormalizedAttemptFixtures.filter(
      ({ expected }) => expected.recognitionGateDecision !== "PASSED",
    );
    expect(gated.map(({ id }) => id)).toEqual([
      handwritingRecognitionUncertain.id,
      handwritingBelowThresholdAbstain.id,
    ]);
    for (const fixture of gated) {
      expect(fixture.expected.decision).toBe("RECOGNITION_UNCERTAIN");
      expect(fixture.expected.failureCode).toBeNull();
      expect(fixture.expected.firstPedagogicalError).toBeNull();
    }
  });

  it("pins the hardened contract and expanded fixture corpus", () => {
    expect(V2_CONTRACT_VERSION).toBe("2.0.0-draft.2");
    expect(kpGoldProblemV2.schemaVersion).toBe(V2_CONTRACT_VERSION);
    expect(kpGoldFixtureMetadata).toMatchObject({
      contractVersion: V2_CONTRACT_VERSION,
      fixtureCount: 16,
    });
    expect(new Set(kpNormalizedAttemptFixtures.map(({ id }) => id)).size).toBe(16);
  });
});
