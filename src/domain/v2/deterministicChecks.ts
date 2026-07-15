import {
  compareFormulaAst,
  evaluateExpression,
  type FormulaComparison,
} from "./expressionEvaluator";
import {
  analyzeCompressedCalculation,
  independentEvidenceStepIds,
  isCompleteCompressedCalculation,
} from "./reasoningAlignment";
import { latestStepMatching, orderedSteps } from "./attemptOrder";
import { analyzeAuthoredEquationSemantics } from "./authoredEquationSemantics";
import type { ReasoningAlignmentResult } from "./reasoningAlignment";
import type {
  DeterministicCheckEvidence,
  DiagnosisCategory,
  DiagnosisFailureCode,
  DiagnosticProblemDefinitionV2,
  ExpectedStageEvaluation,
  NormalizedAttempt,
  NormalizedStep,
  AttemptRevision,
} from "./types";

export const V2_DETERMINISTIC_TOOL_VERSION = "v2-diagnostic-tools-2.0.0-draft.2";
export const V2_NUMERIC_ABSOLUTE_TOLERANCE = 1e-9;

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

interface StageValue {
  status: ExpectedStageEvaluation["status"];
  failureCode: DiagnosisFailureCode | null;
  evidenceStepIds: readonly string[];
}

export interface DeterministicDiagnosisEvidence {
  readonly deterministicChecks: readonly DeterministicCheckEvidence[];
  readonly stageEvaluations: readonly ExpectedStageEvaluation[];
  readonly selectedStrategyId: string | null;
}

function evaluation(
  status: StageValue["status"],
  evidenceStepIds: readonly string[] = [],
  failureCode: DiagnosisFailureCode | null = null,
): StageValue {
  return { status, failureCode, evidenceStepIds };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function formulaFailure(comparison: FormulaComparison): DiagnosisFailureCode {
  return comparison === "INVERTED_RELATION"
    ? "INVERTED_RELATION"
    : comparison === "WRONG_SPECIES"
      ? "WRONG_SPECIES"
      : comparison === "WRONG_STOICHIOMETRIC_POWER"
        ? "WRONG_STOICHIOMETRIC_POWER"
        : "WRONG_FORMULA";
}

function latestResultStep(attempt: NormalizedAttempt): NormalizedStep | null {
  return latestStepMatching(
    attempt,
    (step) =>
      step.calculation?.target.source === "REASONING_QUANTITY" &&
      step.calculation.target.reasoningNodeId === "calculate-result",
  );
}

function firstEquationMismatch(
  problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
): string | null {
  const attemptSteps = orderedSteps(attempt);
  const declared = new Map<string, number>();
  const prior = new Set<string>();
  for (const step of attemptSteps) {
    if (step.calculation?.declaredResult) {
      const recomputed = evaluateExpression(step.calculation.expression, {
        problem,
        declaredStepResults: declared,
        priorStepIds: prior,
      });
      if (
        !recomputed.ok ||
        Math.abs(recomputed.value - step.calculation.declaredResult.value) >
          V2_NUMERIC_ABSOLUTE_TOLERANCE
      ) {
        return step.id;
      }
      declared.set(step.id, step.calculation.declaredResult.value);
    }
    prior.add(step.id);
  }
  return null;
}

function linkedHintStepIds(
  problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
  baseEvaluation: ExpectedStageEvaluation,
  decisionRevision: AttemptRevision,
): readonly string[] {
  const eventById = new Map(attempt.assistanceEvents.map((event) => [event.id, event]));
  for (const eventId of decisionRevision.precededByAssistanceEventIds) {
    const event = eventById.get(eventId);
    if (!event) continue;
    const relevant =
      event.stage === baseEvaluation.category ||
      event.revealedReasoningNodeIds.some(
        (nodeId) =>
          problem.reasoningGraph.nodes[nodeId]?.category === baseEvaluation.category,
      );
    if (!relevant) continue;
    const evidencedStepIds = decisionRevision.stepIds.filter((stepId) =>
      baseEvaluation.evidenceStepIds.includes(stepId),
    );
    if (evidencedStepIds.length > 0) return evidencedStepIds;
  }
  return [];
}

export function applyHintSupportOverlay(
  problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
  baseStageEvaluations: readonly ExpectedStageEvaluation[],
  decisionRevision: AttemptRevision | null,
): readonly ExpectedStageEvaluation[] {
  if (!decisionRevision) return baseStageEvaluations;
  return baseStageEvaluations.map((item) => {
    if (item.status === "INCORRECT") return item;
    const supportedStepIds = linkedHintStepIds(
      problem,
      attempt,
      item,
      decisionRevision,
    );
    return supportedStepIds.length > 0
      ? {
          ...item,
          status: "SUPPORTED_BY_HINT" as const,
          evidenceStepIds: supportedStepIds,
        }
      : item;
  });
}

export function runDeterministicChecks(
  problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
  alignment: ReasoningAlignmentResult,
): DeterministicDiagnosisEvidence {
  const selectedStrategy = alignment.strategyMatches.find(({ matched }) => matched) ?? null;
  const explicitMatched = selectedStrategy?.strategyId === "EXPLICIT_PARTIAL_PRESSURES";
  const compressedMatched = selectedStrategy?.strategyId === "COMPRESSED_DIRECT_SUBSTITUTION";
  const attemptSteps = orderedSteps(attempt);
  const allStepIds = attemptSteps.map(({ id }) => id);
  const equationSemantics = analyzeAuthoredEquationSemantics(problem, attempt);
  const firstSemanticMismatch = attemptSteps.find(
    (step) =>
      equationSemantics.get(step.id)?.authoritative &&
      !equationSemantics.get(step.id)?.valid &&
      (!step.calculation ||
        !analyzeCompressedCalculation(problem, step.calculation.expression)
          .dependenciesComplete),
  );
  const resultStep = latestResultStep(attempt);
  const resultStepIds = resultStep ? [resultStep.id] : [];
  const compressedAnalysis = resultStep?.calculation
    ? analyzeCompressedCalculation(problem, resultStep.calculation.expression)
    : null;
  const formulaSteps = attemptSteps.filter(({ formulaAst }) => formulaAst !== undefined);
  const formulaStepIds = formulaSteps.length > 0
    ? formulaSteps.map(({ id }) => id)
    : compressedAnalysis?.dependenciesComplete
      ? resultStepIds
      : [];
  const stage = new Map<DiagnosisCategory, StageValue>();
  const independentDataEvidence = independentEvidenceStepIds(
    problem,
    alignment,
    "DATA_EXTRACTION",
  );
  const independentTargetEvidence = independentEvidenceStepIds(
    problem,
    alignment,
    "TARGET_IDENTIFICATION",
  );
  const independentFormulaEvidence = independentEvidenceStepIds(
    problem,
    alignment,
    "FORMULA",
  );

  const irrelevantUses = attempt.factsUsed.filter((use) =>
    problem.authoredFacts.some((fact) => fact.id === use.factId && fact.relevance === "IRRELEVANT"),
  );
  const explicitDataSelection = attemptSteps.some(
    ({ semanticType }) => semanticType === "DATA_SELECTION",
  );
  const invalidRequiredUses = attempt.factsUsed.filter((use) => {
    const authored = problem.authoredFacts.find((fact) => fact.id === use.factId);
    if (!authored || authored.relevance !== "REQUIRED") return false;
    const valueMatches =
      typeof authored.value === "number" && typeof use.observedValue === "number"
        ? Math.abs(authored.value - use.observedValue) <= V2_NUMERIC_ABSOLUTE_TOLERANCE
        : authored.value === use.observedValue;
    return !valueMatches || authored.unit !== use.unit;
  });
  const missingRequiredFacts = explicitDataSelection
    ? problem.authoredFacts.filter(
        (fact) =>
          fact.relevance === "REQUIRED" &&
          !attempt.factsUsed.some((use) => use.factId === fact.id),
      )
    : [];
  const factEvidence = unique(attempt.factsUsed.flatMap(({ evidenceStepIds }) => evidenceStepIds));
  const hasLevelFour = attempt.assistanceEvents.some(({ level }) => level === 4);
  if (irrelevantUses.length > 0) {
    stage.set(
      "DATA_EXTRACTION",
      evaluation(
        "INCORRECT",
        unique(irrelevantUses.flatMap(({ evidenceStepIds }) => evidenceStepIds)),
        "IRRELEVANT_DATA_USED",
      ),
    );
  } else if (invalidRequiredUses.length > 0 || missingRequiredFacts.length > 0) {
    stage.set(
      "DATA_EXTRACTION",
      evaluation(
        "INCORRECT",
        unique(invalidRequiredUses.flatMap(({ evidenceStepIds }) => evidenceStepIds)),
        "RELEVANT_DATA_OMITTED",
      ),
    );
  } else if (independentDataEvidence.length > 0) {
    stage.set(
      "DATA_EXTRACTION",
      evaluation("CORRECT", explicitMatched ? allStepIds : independentDataEvidence),
    );
  } else {
    const contextual =
      factEvidence.length > 0
        ? hasLevelFour
          ? []
          : factEvidence
        : attemptSteps
              .filter(
                (step) =>
                  step.semanticType === "FINAL_ANSWER" ||
                  step.semanticType === "SUBSTITUTION" ||
                  (step.semanticType === "STRATEGY" && step.concept === "KP_RESULT"),
              )
              .map(({ id }) => id);
    stage.set("DATA_EXTRACTION", evaluation("NOT_OBSERVED", contextual));
  }

  const explicitTargetEvidence = attempt.target?.explicit
    ? attempt.target.evidenceStepIds.filter((stepId) =>
        independentTargetEvidence.includes(stepId),
      )
    : [];
  const targetEvidence = explicitMatched
    ? allStepIds
    : explicitTargetEvidence.length > 0
      ? explicitTargetEvidence
      : independentTargetEvidence;
  if (
    (attempt.target?.quantity === "KC" || attempt.target?.quantity === "OTHER") &&
    independentTargetEvidence.length > 0
  ) {
    stage.set(
      "TARGET_IDENTIFICATION",
      evaluation("INCORRECT", attempt.target.evidenceStepIds, "TARGET_MISIDENTIFIED"),
    );
  } else if (attempt.target?.quantity === "KP" && independentTargetEvidence.length > 0) {
    stage.set("TARGET_IDENTIFICATION", evaluation("CORRECT", targetEvidence));
  } else {
    stage.set("TARGET_IDENTIFICATION", evaluation("NOT_OBSERVED"));
  }

  const explicitStrategySteps = attemptSteps.filter(({ semanticType }) => semanticType === "STRATEGY");
  const wrongStrategy = explicitStrategySteps.find(
    (step) => step.concept === "KP_RESULT" && !step.formulaAst && !step.calculation,
  );
  let strategyEvidence: readonly string[] = [];
  if (explicitMatched) strategyEvidence = allStepIds;
  else if (compressedMatched) {
    strategyEvidence = unique([
      ...explicitStrategySteps.map(({ id }) => id),
      ...attemptSteps
        .filter((step) =>
          step.calculation && isCompleteCompressedCalculation(problem, step.calculation.expression),
        )
        .map(({ id }) => id),
    ]);
  } else if (explicitStrategySteps.some((step) => step.concept === "PARTIAL_PRESSURE" || step.concept === "KP_EXPRESSION")) {
    strategyEvidence = explicitStrategySteps.map(({ id }) => id);
  }
  if (wrongStrategy) {
    stage.set("STRATEGY", evaluation("INCORRECT", [wrongStrategy.id], "WRONG_METHOD"));
  } else if (strategyEvidence.length > 0) {
    stage.set("STRATEGY", evaluation("CORRECT", strategyEvidence));
  } else {
    stage.set("STRATEGY", evaluation("NOT_OBSERVED", formulaStepIds.length > 0 ? formulaStepIds : resultStepIds));
  }

  const authoredFormula = problem.formulaDefinitions.find(
    ({ id }) => id === "formula-kp-no2-n2o4",
  )?.expression;
  const observedFormula = formulaSteps.at(-1)?.formulaAst;
  const comparison =
    authoredFormula && observedFormula
      ? compareFormulaAst(observedFormula, authoredFormula)
      : compressedAnalysis?.dependenciesComplete
        ? compressedAnalysis.formulaComparison
        : null;
  if (comparison === "EQUIVALENT" && independentFormulaEvidence.length > 0) {
    stage.set(
      "FORMULA",
      evaluation("CORRECT", explicitMatched ? allStepIds : independentFormulaEvidence),
    );
  } else if (comparison) {
    stage.set("FORMULA", evaluation("INCORRECT", formulaStepIds, formulaFailure(comparison)));
  } else {
    stage.set("FORMULA", evaluation("NOT_OBSERVED"));
  }

  const formulaStage = stage.get("FORMULA")!;
  let substitution: StageValue;
  if (formulaStage.status === "INCORRECT") {
    substitution = evaluation("DOWNSTREAM_AFFECTED", formulaStepIds);
  } else if (firstSemanticMismatch) {
    substitution = evaluation(
      "INCORRECT",
      [firstSemanticMismatch.id],
      "WRONG_DEPENDENCY_USED",
    );
  } else if (!resultStep?.calculation) {
    substitution = evaluation("NOT_OBSERVED");
  } else if (
    isCompleteCompressedCalculation(problem, resultStep.calculation.expression) ||
    equationSemantics.get(resultStep.id)?.valid
  ) {
    substitution = evaluation("CORRECT", explicitMatched ? allStepIds : resultStepIds);
  } else if (comparison === "EQUIVALENT") {
    substitution = evaluation("INCORRECT", resultStepIds, "WRONG_DEPENDENCY_USED");
  } else {
    substitution = evaluation("NOT_OBSERVED", resultStepIds);
  }
  stage.set("SUBSTITUTION", substitution);

  if (substitution.status === "INCORRECT" || formulaStage.status === "INCORRECT") {
    stage.set("ARITHMETIC", evaluation("DOWNSTREAM_AFFECTED", resultStepIds.length ? resultStepIds : formulaStepIds));
  } else if (!resultStep?.calculation?.declaredResult || substitution.status !== "CORRECT") {
    stage.set("ARITHMETIC", evaluation("NOT_OBSERVED"));
  } else {
    const mismatchStepId = firstEquationMismatch(problem, attempt);
    if (mismatchStepId) {
      stage.set(
        "ARITHMETIC",
        evaluation("INCORRECT", [mismatchStepId], "ARITHMETIC_ERROR"),
      );
    } else {
      stage.set("ARITHMETIC", evaluation("CORRECT", explicitMatched ? allStepIds : resultStepIds));
    }
  }

  const finalAnswer = attempt.finalAnswer;
  if (formulaStage.status === "INCORRECT") {
    stage.set("UNIT", evaluation("DOWNSTREAM_AFFECTED", resultStepIds.length ? resultStepIds : formulaStepIds));
  } else if (!finalAnswer?.unit) {
    stage.set("UNIT", evaluation("NOT_OBSERVED"));
  } else if (!problem.target.acceptedUnits.includes(finalAnswer.unit)) {
    stage.set("UNIT", evaluation("INCORRECT", resultStepIds, "UNIT_ERROR"));
  } else {
    stage.set("UNIT", evaluation("CORRECT", explicitMatched ? allStepIds : resultStepIds));
  }

  if (finalAnswer?.significantFigures === undefined) {
    stage.set("PRECISION", evaluation("NOT_OBSERVED"));
  } else if (finalAnswer.significantFigures !== problem.target.significantFigures) {
    stage.set("PRECISION", evaluation("INCORRECT", resultStepIds, "SIGNIFICANT_FIGURES_ERROR"));
  } else {
    stage.set("PRECISION", evaluation("CORRECT", explicitMatched ? allStepIds : resultStepIds));
  }

  const baseStageEvaluations = diagnosisOrder.map((category) => ({
    category,
    ...stage.get(category)!,
  }));
  const deterministicChecks = baseStageEvaluations.map<DeterministicCheckEvidence>((item) => ({
    category: item.category,
    stepIds: item.evidenceStepIds,
    toolVersion: V2_DETERMINISTIC_TOOL_VERSION,
    outcome:
      item.status === "CORRECT"
        ? "PASS"
        : item.status === "INCORRECT"
          ? "FAIL"
          : "NOT_RUN",
    failureCode: item.status === "INCORRECT" ? item.failureCode : null,
  }));
  return {
    deterministicChecks,
    stageEvaluations: baseStageEvaluations,
    selectedStrategyId: selectedStrategy?.strategyId ?? null,
  };
}
