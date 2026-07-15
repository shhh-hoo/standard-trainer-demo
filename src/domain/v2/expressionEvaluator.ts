import type {
  DiagnosticProblemDefinitionV2,
  ExpressionAst,
  VariableReference,
} from "./types";

export interface ExpressionEvaluationContext {
  readonly problem: DiagnosticProblemDefinitionV2;
  readonly declaredStepResults?: ReadonlyMap<string, number>;
  readonly priorStepIds?: ReadonlySet<string>;
  readonly resolvedReasoningQuantities?: ReadonlyMap<string, number>;
}

export type ExpressionEvaluationResult =
  | {
      readonly ok: true;
      readonly value: number;
      readonly usedReferences: readonly VariableReference[];
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

function failure(code: string, message: string): ExpressionEvaluationResult {
  return { ok: false, code, message };
}

export function evaluateExpression(
  expression: ExpressionAst,
  context: ExpressionEvaluationContext,
): ExpressionEvaluationResult {
  const usedReferences: VariableReference[] = [];
  const authoredFacts = new Map(
    context.problem.authoredFacts
      .filter((fact): fact is typeof fact & { readonly value: number } =>
        typeof fact.value === "number",
      )
      .map((fact) => [fact.id, fact.value]),
  );

  const visit = (node: ExpressionAst): number | ExpressionEvaluationResult => {
    if (node.kind === "NUMBER") {
      return Number.isFinite(node.value)
        ? node.value
        : failure("NON_FINITE_NUMBER", "Number expressions must be finite.");
    }

    if (node.kind === "VARIABLE") {
      const reference = node.reference;
      usedReferences.push(reference);
      if (reference.source === "AUTHORED_FACT") {
        const value = authoredFacts.get(reference.factId);
        return value === undefined
          ? failure("UNRESOLVED_AUTHORED_FACT", `Unknown numeric fact: ${reference.factId}`)
          : value;
      }
      if (reference.source === "NORMALIZED_STEP_RESULT") {
        if (context.priorStepIds && !context.priorStepIds.has(reference.stepId)) {
          return failure(
            "FORWARD_STEP_REFERENCE",
            `Step result is not available from an earlier step: ${reference.stepId}`,
          );
        }
        const value = context.declaredStepResults?.get(reference.stepId);
        return value === undefined
          ? failure("UNRESOLVED_STEP_RESULT", `No declared result for step: ${reference.stepId}`)
          : value;
      }
      const value = context.resolvedReasoningQuantities?.get(reference.reasoningNodeId);
      return value === undefined
        ? failure(
            "UNSUPPORTED_REASONING_QUANTITY",
            `Reasoning quantity requires an explicit resolved value: ${reference.reasoningNodeId}`,
          )
        : value;
    }

    if (node.kind === "FUNCTION") {
      if (node.name !== "SUM") {
        return failure("UNSUPPORTED_FUNCTION", `Unsupported function: ${String(node.name)}`);
      }
      let sum = 0;
      for (const argument of node.arguments) {
        const value = visit(argument);
        if (typeof value !== "number") return value;
        sum += value;
      }
      return Number.isFinite(sum)
        ? sum
        : failure("NON_FINITE_RESULT", "Expression result must be finite.");
    }

    const left = visit(node.left);
    if (typeof left !== "number") return left;
    const right = visit(node.right);
    if (typeof right !== "number") return right;
    if (node.operator === "DIVIDE" && right === 0) {
      return failure("DIVISION_BY_ZERO", "Division by zero is not defined.");
    }

    const value =
      node.operator === "ADD"
        ? left + right
        : node.operator === "SUBTRACT"
          ? left - right
          : node.operator === "MULTIPLY"
            ? left * right
            : node.operator === "DIVIDE"
              ? left / right
              : left ** right;
    return Number.isFinite(value)
      ? value
      : failure("NON_FINITE_RESULT", "Expression result must be finite.");
  };

  const value = visit(expression);
  return typeof value === "number" ? { ok: true, value, usedReferences } : value;
}

function referencesEqual(left: VariableReference, right: VariableReference): boolean {
  if (left.source !== right.source || left.symbol !== right.symbol) return false;
  if (left.source === "AUTHORED_FACT" && right.source === "AUTHORED_FACT") {
    return left.factId === right.factId;
  }
  if (
    left.source === "NORMALIZED_STEP_RESULT" &&
    right.source === "NORMALIZED_STEP_RESULT"
  ) {
    return left.stepId === right.stepId;
  }
  return (
    left.source === "REASONING_QUANTITY" &&
    right.source === "REASONING_QUANTITY" &&
    left.reasoningNodeId === right.reasoningNodeId
  );
}

export function expressionsStructurallyEqual(left: ExpressionAst, right: ExpressionAst): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "NUMBER" && right.kind === "NUMBER") {
    return left.value === right.value;
  }
  if (left.kind === "VARIABLE" && right.kind === "VARIABLE") {
    return referencesEqual(left.reference, right.reference);
  }
  if (left.kind === "BINARY" && right.kind === "BINARY") {
    return (
      left.operator === right.operator &&
      expressionsStructurallyEqual(left.left, right.left) &&
      expressionsStructurallyEqual(left.right, right.right)
    );
  }
  if (left.kind === "FUNCTION" && right.kind === "FUNCTION") {
    return (
      left.name === right.name &&
      left.arguments.length === right.arguments.length &&
      left.arguments.every((argument, index) =>
        expressionsStructurallyEqual(argument, right.arguments[index]!),
      )
    );
  }
  return false;
}

export type FormulaComparison =
  | "EQUIVALENT"
  | "INVERTED_RELATION"
  | "WRONG_SPECIES"
  | "WRONG_STOICHIOMETRIC_POWER"
  | "NOT_EQUIVALENT";

function swapDivision(expression: ExpressionAst): ExpressionAst | null {
  return expression.kind === "BINARY" && expression.operator === "DIVIDE"
    ? { ...expression, left: expression.right, right: expression.left }
    : null;
}

function reasoningReferences(expression: ExpressionAst): readonly VariableReference[] {
  if (expression.kind === "VARIABLE") return [expression.reference];
  if (expression.kind === "NUMBER") return [];
  if (expression.kind === "FUNCTION") return expression.arguments.flatMap(reasoningReferences);
  return [...reasoningReferences(expression.left), ...reasoningReferences(expression.right)];
}

export function compareFormulaAst(
  observed: ExpressionAst,
  authored: ExpressionAst,
): FormulaComparison {
  if (expressionsStructurallyEqual(observed, authored)) return "EQUIVALENT";
  const inverted = swapDivision(authored);
  if (inverted && expressionsStructurallyEqual(observed, inverted)) return "INVERTED_RELATION";

  const authoredRefs = reasoningReferences(authored)
    .filter((ref) => ref.source === "REASONING_QUANTITY")
    .map((ref) => ref.reasoningNodeId)
    .sort();
  const observedRefs = reasoningReferences(observed)
    .filter((ref) => ref.source === "REASONING_QUANTITY")
    .map((ref) => ref.reasoningNodeId)
    .sort();
  if (authoredRefs.join("|") !== observedRefs.join("|")) return "WRONG_SPECIES";

  const authoredPower = authored.kind === "BINARY" ? authored.left : null;
  const observedPower = observed.kind === "BINARY" ? observed.left : null;
  if (
    authoredPower?.kind === "BINARY" &&
    authoredPower.operator === "POWER" &&
    observedPower?.kind === "BINARY" &&
    observedPower.operator === "POWER"
  ) {
    return "WRONG_STOICHIOMETRIC_POWER";
  }
  return "NOT_EQUIVALENT";
}

export function collectVariableReferences(expression: ExpressionAst): readonly VariableReference[] {
  return reasoningReferences(expression);
}
