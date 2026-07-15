import { collectVariableReferences } from "./expressionEvaluator";
import type {
  DiagnosticProblemDefinitionV2,
  ExpressionAst,
  NormalizedAttempt,
  NormalizedStep,
  ReasoningAlignmentEvidence,
  ReasoningEvidenceKind,
} from "./types";

export interface StrategyMatchResult {
  readonly strategyId: string;
  readonly matched: boolean;
  readonly matchedNodeIds: readonly string[];
  readonly missingNodeIds: readonly string[];
  readonly specificity: number;
}

export interface ReasoningAlignmentResult {
  readonly evidence: readonly ReasoningAlignmentEvidence[];
  readonly strategyMatches: readonly StrategyMatchResult[];
}

function variableFactId(expression: ExpressionAst): string | null {
  return expression.kind === "VARIABLE" && expression.reference.source === "AUTHORED_FACT"
    ? expression.reference.factId
    : null;
}

function totalContainsFacts(expression: ExpressionAst, expected: ReadonlySet<string>): boolean {
  if (
    expression.kind !== "BINARY" ||
    expression.operator !== "ADD"
  ) {
    if (expression.kind !== "FUNCTION" || expression.name !== "SUM") return false;
    const ids = expression.arguments.map(variableFactId).filter((id): id is string => id !== null);
    return ids.length === expected.size && ids.every((id) => expected.has(id));
  }
  const ids = [variableFactId(expression.left), variableFactId(expression.right)].filter(
    (id): id is string => id !== null,
  );
  return ids.length === expected.size && ids.every((id) => expected.has(id));
}

function partialPressureFact(
  expression: ExpressionAst,
  moleFactIds: ReadonlySet<string>,
  pressureFactId: string,
): string | null {
  if (expression.kind !== "BINARY" || expression.operator !== "MULTIPLY") return null;
  const candidates: readonly [ExpressionAst, ExpressionAst][] = [
    [expression.left, expression.right],
    [expression.right, expression.left],
  ];
  for (const [fraction, pressure] of candidates) {
    if (variableFactId(pressure) !== pressureFactId) continue;
    if (fraction.kind !== "BINARY" || fraction.operator !== "DIVIDE") continue;
    const numeratorId = variableFactId(fraction.left);
    if (
      numeratorId &&
      moleFactIds.has(numeratorId) &&
      totalContainsFacts(fraction.right, moleFactIds)
    ) {
      return numeratorId;
    }
  }
  return null;
}

export function isCompleteCompressedCalculation(
  problem: DiagnosticProblemDefinitionV2,
  expression: ExpressionAst,
): boolean {
  const moleFacts = problem.authoredFacts.filter(
    (fact) => fact.relevance === "REQUIRED" && fact.unit === "mol" && typeof fact.value === "number",
  );
  const pressureFact = problem.authoredFacts.find(
    (fact) =>
      fact.relevance === "REQUIRED" &&
      problem.target.acceptedUnits.includes(fact.unit ?? "") &&
      typeof fact.value === "number",
  );
  if (moleFacts.length !== 2 || !pressureFact) return false;
  if (expression.kind !== "BINARY" || expression.operator !== "DIVIDE") return false;
  if (
    expression.left.kind !== "BINARY" ||
    expression.left.operator !== "POWER" ||
    expression.left.right.kind !== "NUMBER" ||
    expression.left.right.value !== 2
  ) {
    return false;
  }
  const moleFactIds = new Set(moleFacts.map(({ id }) => id));
  const numeratorSpecies = partialPressureFact(
    expression.left.left,
    moleFactIds,
    pressureFact.id,
  );
  const denominatorSpecies = partialPressureFact(
    expression.right,
    moleFactIds,
    pressureFact.id,
  );
  return (
    numeratorSpecies !== null &&
    denominatorSpecies !== null &&
    numeratorSpecies !== denominatorSpecies
  );
}

function explicitNodeEvidence(step: NormalizedStep): readonly [string, ReasoningEvidenceKind][] {
  const evidence: [string, ReasoningEvidenceKind][] = [];
  if (step.semanticType === "DATA_SELECTION") evidence.push(["select-relevant-data", "EXPLICIT_STEP"]);
  if (step.semanticType === "TARGET_IDENTIFICATION") evidence.push(["identify-kp-target", "TARGET_STATEMENT"]);
  if (step.semanticType === "STRATEGY") evidence.push(["choose-partial-pressure-strategy", "EXPLICIT_STEP"]);
  if (step.formulaAst) {
    evidence.push(["identify-kp-target", "FORMULA_AST"]);
    evidence.push(["construct-kp-expression", "FORMULA_AST"]);
  }
  const target = step.calculation?.target;
  if (target?.source === "REASONING_QUANTITY") {
    evidence.push([target.reasoningNodeId, "EQUATION"]);
    if (step.calculation?.declaredResult) evidence.push([target.reasoningNodeId, "DECLARED_RESULT"]);
    if (
      [
        "total-moles",
        "mole-fraction-n2o4",
        "mole-fraction-no2",
        "partial-pressure-n2o4",
        "partial-pressure-no2",
      ].includes(target.reasoningNodeId)
    ) {
      evidence.push(["choose-partial-pressure-strategy", "EQUATION"]);
    }
    if (target.reasoningNodeId === "calculate-result") {
      evidence.push(["substitute-values", "EQUATION"]);
    }
  }
  if (step.calculation?.declaredResult?.unit) {
    evidence.push(["report-unit", "DECLARED_RESULT"]);
  }
  if (step.calculation?.declaredResult?.significantFigures !== undefined) {
    evidence.push(["report-precision", "DECLARED_RESULT"]);
  }
  return evidence;
}

export function alignReasoningEvidence(
  problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
): ReasoningAlignmentResult {
  const evidence: ReasoningAlignmentEvidence[] = [];
  const add = (stepId: string, nodeId: string, evidenceKind: ReasoningEvidenceKind) => {
    if (!problem.reasoningGraph.nodes[nodeId]) return;
    evidence.push({
      normalizedStepId: stepId,
      reasoningNodeIds: [nodeId],
      confidence: evidenceKind === "INFERRED" ? 0.5 : 1,
      evidenceKind,
    });
  };

  for (const factUse of attempt.factsUsed) {
    factUse.evidenceStepIds.forEach((stepId) => add(stepId, "select-relevant-data", "FACT_USE"));
  }
  if (attempt.target) {
    attempt.target.evidenceStepIds.forEach((stepId) =>
      add(stepId, "identify-kp-target", attempt.target?.explicit ? "TARGET_STATEMENT" : "INFERRED"),
    );
  }
  for (const step of attempt.steps) {
    explicitNodeEvidence(step).forEach(([nodeId, kind]) => add(step.id, nodeId, kind));
    if (step.calculation && isCompleteCompressedCalculation(problem, step.calculation.expression)) {
      for (const nodeId of [
        "identify-kp-target",
        "choose-partial-pressure-strategy",
        "total-moles",
        "mole-fraction-n2o4",
        "mole-fraction-no2",
        "partial-pressure-n2o4",
        "partial-pressure-no2",
        "construct-kp-expression",
        "substitute-values",
        "calculate-result",
      ]) {
        add(step.id, nodeId, "EMBEDDED_CALCULATION");
      }
    }
  }

  const kindsByNode = new Map<string, Set<ReasoningEvidenceKind>>();
  for (const item of evidence) {
    for (const nodeId of item.reasoningNodeIds) {
      const kinds = kindsByNode.get(nodeId) ?? new Set<ReasoningEvidenceKind>();
      kinds.add(item.evidenceKind);
      kindsByNode.set(nodeId, kinds);
    }
  }
  const strategyMatches = problem.reasoningGraph.acceptedStrategies.map((strategy) => {
    const matchedNodeIds: string[] = [];
    const missingNodeIds: string[] = [];
    for (const requirement of strategy.nodeRequirements) {
      if (requirement.requirement === "OPTIONAL") continue;
      const kinds = kindsByNode.get(requirement.nodeId);
      if (kinds && requirement.allowedEvidenceKinds.some((kind) => kinds.has(kind))) {
        matchedNodeIds.push(requirement.nodeId);
      } else {
        missingNodeIds.push(requirement.nodeId);
      }
    }
    return {
      strategyId: strategy.id,
      matched: missingNodeIds.length === 0,
      matchedNodeIds,
      missingNodeIds,
      specificity: matchedNodeIds.length,
    };
  });
  return { evidence, strategyMatches };
}

export function expressionUsesOnlyPriorStepResults(
  expression: ExpressionAst,
  priorStepIds: ReadonlySet<string>,
): boolean {
  return collectVariableReferences(expression).every(
    (reference) =>
      reference.source !== "NORMALIZED_STEP_RESULT" || priorStepIds.has(reference.stepId),
  );
}
