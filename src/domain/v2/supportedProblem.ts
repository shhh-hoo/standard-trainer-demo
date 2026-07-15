import type { ValidationResult } from "./runtimeValidation";
import type { DiagnosticProblemDefinitionV2, ExpressionAst } from "./types";

function expressionReferences(expression: ExpressionAst): readonly { readonly source: string; readonly id: string }[] {
  if (expression.kind === "VARIABLE") {
    return [{
      source: expression.reference.source,
      id: expression.reference.source === "AUTHORED_FACT"
        ? expression.reference.factId
        : expression.reference.source === "REASONING_QUANTITY"
          ? expression.reference.reasoningNodeId
          : expression.reference.stepId,
    }];
  }
  if (expression.kind === "BINARY") return [...expressionReferences(expression.left), ...expressionReferences(expression.right)];
  if (expression.kind === "FUNCTION") return expression.arguments.flatMap(expressionReferences);
  return [];
}

export function validateSupportedDiagnosticProblem(problem: DiagnosticProblemDefinitionV2): ValidationResult<DiagnosticProblemDefinitionV2> {
  const failures: string[] = [];
  const nodeIds = new Set(Object.keys(problem.reasoningGraph.nodes));
  const factIds = new Set(problem.authoredFacts.map((fact) => fact.id));
  const ordered = problem.reasoningGraph.pedagogicalOrder;
  if (new Set(ordered).size !== ordered.length || ordered.length !== nodeIds.size) failures.push("Pedagogical order must contain every reasoning node exactly once.");
  for (const nodeId of ordered) {
    const node = problem.reasoningGraph.nodes[nodeId];
    if (!node || node.id !== nodeId) failures.push(`Unresolved reasoning node ${nodeId}.`);
  }
  for (const node of Object.values(problem.reasoningGraph.nodes)) for (const dependency of node.dependencies) if (!nodeIds.has(dependency)) failures.push(`Unresolved dependency ${node.id} → ${dependency}.`);
  for (const formula of problem.formulaDefinitions) {
    if (!nodeIds.has(formula.targetReasoningNodeId)) failures.push(`Unresolved formula target ${formula.targetReasoningNodeId}.`);
    for (const reference of expressionReferences(formula.expression)) {
      if (reference.source === "AUTHORED_FACT" && !factIds.has(reference.id)) failures.push(`Unresolved authored fact ${reference.id}.`);
      if (reference.source === "REASONING_QUANTITY" && !nodeIds.has(reference.id)) failures.push(`Unresolved reasoning quantity ${reference.id}.`);
      if (reference.source === "NORMALIZED_STEP_RESULT") failures.push("Problem formulas cannot depend on learner step results.");
    }
  }
  for (const strategy of problem.reasoningGraph.acceptedStrategies) for (const requirement of strategy.nodeRequirements) if (!nodeIds.has(requirement.nodeId)) failures.push(`Unresolved strategy node ${requirement.nodeId}.`);
  for (const hint of problem.hintPolicy.hints) for (const nodeId of hint.revealedReasoningNodeIds) if (!nodeIds.has(nodeId)) failures.push(`Unresolved hint node ${nodeId}.`);
  return failures.length === 0 ? { ok: true, value: problem } : { ok: false, issues: failures.map((message) => ({ path: "$problem", code: "UNSUPPORTED_PROBLEM_DEFINITION", message })) };
}

