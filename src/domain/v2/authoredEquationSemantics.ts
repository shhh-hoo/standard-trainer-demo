import { orderedSteps } from "./attemptOrder";
import type {
  DiagnosticProblemDefinitionV2,
  ExpressionAst,
  NormalizedAttempt,
  VariableReference,
} from "./types";

export interface AuthoredEquationSemanticResult {
  readonly stepId: string;
  readonly targetReasoningNodeId: string | null;
  readonly authoritative: boolean;
  readonly valid: boolean;
}

const authoredEquationTargets = new Set([
  "total-moles",
  "mole-fraction-n2o4",
  "mole-fraction-no2",
  "partial-pressure-n2o4",
  "partial-pressure-no2",
  "calculate-result",
]);

function fact(factId: string): ExpressionAst {
  return {
    kind: "VARIABLE",
    reference: { source: "AUTHORED_FACT", symbol: factId, factId },
  };
}

function reasoning(reasoningNodeId: string): ExpressionAst {
  return {
    kind: "VARIABLE",
    reference: {
      source: "REASONING_QUANTITY",
      symbol: reasoningNodeId,
      reasoningNodeId,
    },
  };
}

function binary(
  operator: "ADD" | "MULTIPLY" | "DIVIDE",
  left: ExpressionAst,
  right: ExpressionAst,
): ExpressionAst {
  return { kind: "BINARY", operator, left, right };
}

function expectedExpression(
  problem: DiagnosticProblemDefinitionV2,
  reasoningNodeId: string,
): ExpressionAst | null {
  switch (reasoningNodeId) {
    case "total-moles":
      return binary(
        "ADD",
        fact("equilibrium-moles-n2o4"),
        fact("equilibrium-moles-no2"),
      );
    case "mole-fraction-n2o4":
      return binary(
        "DIVIDE",
        fact("equilibrium-moles-n2o4"),
        reasoning("total-moles"),
      );
    case "mole-fraction-no2":
      return binary(
        "DIVIDE",
        fact("equilibrium-moles-no2"),
        reasoning("total-moles"),
      );
    case "partial-pressure-n2o4":
      return binary(
        "MULTIPLY",
        reasoning("mole-fraction-n2o4"),
        fact("total-pressure"),
      );
    case "partial-pressure-no2":
      return binary(
        "MULTIPLY",
        reasoning("mole-fraction-no2"),
        fact("total-pressure"),
      );
    case "calculate-result":
      return (
        problem.formulaDefinitions.find(({ id }) => id === "formula-kp-no2-n2o4")
          ?.expression ?? null
      );
    default:
      return null;
  }
}

function referenceAuthority(
  reference: VariableReference,
  priorStepTargets: ReadonlyMap<string, string>,
): string | null {
  if (reference.source === "AUTHORED_FACT") return `FACT:${reference.factId}`;
  if (reference.source === "REASONING_QUANTITY") {
    return `REASONING:${reference.reasoningNodeId}`;
  }
  const priorTarget = priorStepTargets.get(reference.stepId);
  return priorTarget ? `REASONING:${priorTarget}` : null;
}

function expressionsEquivalent(
  observed: ExpressionAst,
  expected: ExpressionAst,
  priorStepTargets: ReadonlyMap<string, string>,
): boolean {
  if (observed.kind !== expected.kind) return false;
  if (observed.kind === "NUMBER" && expected.kind === "NUMBER") {
    return observed.value === expected.value;
  }
  if (observed.kind === "VARIABLE" && expected.kind === "VARIABLE") {
    const observedAuthority = referenceAuthority(observed.reference, priorStepTargets);
    return (
      observedAuthority !== null &&
      observedAuthority === referenceAuthority(expected.reference, priorStepTargets)
    );
  }
  if (observed.kind === "BINARY" && expected.kind === "BINARY") {
    if (observed.operator !== expected.operator) return false;
    const direct =
      expressionsEquivalent(observed.left, expected.left, priorStepTargets) &&
      expressionsEquivalent(observed.right, expected.right, priorStepTargets);
    if (direct || !["ADD", "MULTIPLY"].includes(observed.operator)) return direct;
    return (
      expressionsEquivalent(observed.left, expected.right, priorStepTargets) &&
      expressionsEquivalent(observed.right, expected.left, priorStepTargets)
    );
  }
  if (observed.kind === "FUNCTION" && expected.kind === "FUNCTION") {
    return (
      observed.name === expected.name &&
      observed.arguments.length === expected.arguments.length &&
      observed.arguments.every((argument, index) =>
        expressionsEquivalent(argument, expected.arguments[index]!, priorStepTargets),
      )
    );
  }
  return false;
}

export function analyzeAuthoredEquationSemantics(
  problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
): ReadonlyMap<string, AuthoredEquationSemanticResult> {
  const results = new Map<string, AuthoredEquationSemanticResult>();
  const priorStepTargets = new Map<string, string>();
  for (const step of orderedSteps(attempt)) {
    const target = step.calculation?.target;
    const targetReasoningNodeId =
      target?.source === "REASONING_QUANTITY" ? target.reasoningNodeId : null;
    if (step.calculation) {
      const authoritative = Boolean(
        targetReasoningNodeId && authoredEquationTargets.has(targetReasoningNodeId),
      );
      const expected = targetReasoningNodeId
        ? expectedExpression(problem, targetReasoningNodeId)
        : null;
      results.set(step.id, {
        stepId: step.id,
        targetReasoningNodeId,
        authoritative,
        valid: Boolean(
          authoritative &&
            expected &&
            expressionsEquivalent(step.calculation.expression, expected, priorStepTargets),
        ),
      });
    }
    if (targetReasoningNodeId) priorStepTargets.set(step.id, targetReasoningNodeId);
  }
  return results;
}
