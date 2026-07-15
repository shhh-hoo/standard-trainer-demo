import {
  collectVariableReferences,
  compareFormulaAst,
  type FormulaComparison,
} from "./expressionEvaluator";
import { orderedSteps } from "./attemptOrder";
import type {
  DiagnosisCategory,
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

export function independentEvidenceStepIds(
  problem: DiagnosticProblemDefinitionV2,
  alignment: ReasoningAlignmentResult,
  category: DiagnosisCategory,
): readonly string[] {
  return [
    ...new Set(
      alignment.evidence
        .filter(
          (item) =>
            item.evidenceKind !== "INFERRED" &&
            item.reasoningNodeIds.some((nodeId) => {
              const node = problem.reasoningGraph.nodes[nodeId];
              return (
                node?.category === category &&
                node.independentStageEvidenceKinds.includes(item.evidenceKind)
              );
            }),
        )
        .map(({ normalizedStepId }) => normalizedStepId),
    ),
  ];
}

export interface CompressedCalculationAnalysis {
  readonly dependenciesComplete: boolean;
  readonly formulaComparison: FormulaComparison;
  readonly evidenceNodeIds: readonly string[];
}

const compressedSpecies = Object.freeze({
  "equilibrium-moles-no2": {
    reasoningNodeId: "partial-pressure-no2",
    symbol: "p_NO2",
  },
  "equilibrium-moles-n2o4": {
    reasoningNodeId: "partial-pressure-n2o4",
    symbol: "p_N2O4",
  },
} as const);

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

export function analyzeCompressedCalculation(
  problem: DiagnosticProblemDefinitionV2,
  expression: ExpressionAst,
): CompressedCalculationAnalysis {
  const no2Fact = problem.authoredFacts.find(({ id }) => id === "equilibrium-moles-no2");
  const n2o4Fact = problem.authoredFacts.find(({ id }) => id === "equilibrium-moles-n2o4");
  const pressureFact = problem.authoredFacts.find(({ id }) => id === "total-pressure");
  const incomplete: CompressedCalculationAnalysis = {
    dependenciesComplete: false,
    formulaComparison: "NOT_EQUIVALENT",
    evidenceNodeIds: [],
  };
  if (!no2Fact || !n2o4Fact || !pressureFact) return incomplete;
  if (expression.kind !== "BINARY" || expression.operator !== "DIVIDE") return incomplete;
  const poweredNumerator =
    expression.left.kind === "BINARY" && expression.left.operator === "POWER"
      ? expression.left
      : null;
  const numeratorPartialPressure = poweredNumerator?.left ?? expression.left;
  const exponent = poweredNumerator?.right;
  const moleFactIds = new Set([no2Fact.id, n2o4Fact.id]);
  const numeratorSpecies = partialPressureFact(
    numeratorPartialPressure,
    moleFactIds,
    pressureFact.id,
  );
  const denominatorSpecies = partialPressureFact(
    expression.right,
    moleFactIds,
    pressureFact.id,
  );
  const dependenciesComplete =
    numeratorSpecies !== null &&
    denominatorSpecies !== null &&
    numeratorSpecies !== denominatorSpecies;
  if (!dependenciesComplete) return incomplete;

  const numeratorDefinition = compressedSpecies[numeratorSpecies as keyof typeof compressedSpecies];
  const denominatorDefinition =
    compressedSpecies[denominatorSpecies as keyof typeof compressedSpecies];
  if (!numeratorDefinition || !denominatorDefinition) return incomplete;
  const observedFormula: ExpressionAst = {
    kind: "BINARY",
    operator: "DIVIDE",
    left: exponent
      ? {
          kind: "BINARY",
          operator: "POWER",
          left: {
            kind: "VARIABLE",
            reference: {
              source: "REASONING_QUANTITY",
              symbol: numeratorDefinition.symbol,
              reasoningNodeId: numeratorDefinition.reasoningNodeId,
            },
          },
          right: exponent,
        }
      : {
          kind: "VARIABLE",
          reference: {
            source: "REASONING_QUANTITY",
            symbol: numeratorDefinition.symbol,
            reasoningNodeId: numeratorDefinition.reasoningNodeId,
          },
        },
    right: {
      kind: "VARIABLE",
      reference: {
        source: "REASONING_QUANTITY",
        symbol: denominatorDefinition.symbol,
        reasoningNodeId: denominatorDefinition.reasoningNodeId,
      },
    },
  };
  const authoredFormula = problem.formulaDefinitions.find(
    ({ id }) => id === "formula-kp-no2-n2o4",
  )?.expression;
  let formulaComparison: FormulaComparison = authoredFormula
    ? compareFormulaAst(observedFormula, authoredFormula)
    : "NOT_EQUIVALENT";
  if (
    numeratorSpecies === "equilibrium-moles-n2o4" &&
    denominatorSpecies === "equilibrium-moles-no2" &&
    exponent?.kind === "NUMBER" &&
    exponent.value === 2
  ) {
    formulaComparison = "WRONG_STOICHIOMETRIC_POWER";
  }
  const dependencyNodes = [
    "identify-kp-target",
    "choose-partial-pressure-strategy",
    "total-moles",
    "mole-fraction-n2o4",
    "mole-fraction-no2",
    "partial-pressure-n2o4",
    "partial-pressure-no2",
  ];
  return {
    dependenciesComplete,
    formulaComparison,
    evidenceNodeIds:
      formulaComparison === "EQUIVALENT"
        ? [
            ...dependencyNodes,
            "construct-kp-expression",
            "substitute-values",
            "calculate-result",
          ]
        : dependencyNodes,
  };
}

export function isCompleteCompressedCalculation(
  problem: DiagnosticProblemDefinitionV2,
  expression: ExpressionAst,
): boolean {
  const analysis = analyzeCompressedCalculation(problem, expression);
  return analysis.dependenciesComplete && analysis.formulaComparison === "EQUIVALENT";
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
  const attemptSteps = orderedSteps(attempt);
  const stepById = new Map(attemptSteps.map((step) => [step.id, step]));
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
    attempt.target.evidenceStepIds.forEach((stepId) => {
      const step = stepById.get(stepId);
      const independentlyObservable = Boolean(
        step &&
          (step.semanticType === "TARGET_IDENTIFICATION" ||
            step.semanticType === "STRATEGY" ||
            step.formulaAst ||
            step.calculation),
      );
      add(
        stepId,
        "identify-kp-target",
        attempt.target?.explicit && independentlyObservable
          ? "TARGET_STATEMENT"
          : "INFERRED",
      );
    });
  }
  for (const step of attemptSteps) {
    explicitNodeEvidence(step).forEach(([nodeId, kind]) => add(step.id, nodeId, kind));
    if (step.calculation) {
      const compressed = analyzeCompressedCalculation(problem, step.calculation.expression);
      for (const nodeId of compressed.evidenceNodeIds) {
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
