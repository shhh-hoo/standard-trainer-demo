import {
  checkExpression,
  checkNumeric,
  checkSignificantFigures,
  checkUnit,
  TOOL_VERSIONS,
} from "./deterministicTools";
import type {
  CalculationEvidenceTrace,
  CalculationPathSubmission,
  PathFailureCode,
  ProblemDefinition,
  StepEvaluation,
  StudentStepInput,
} from "./types";

export const CALCULATION_PATH_ENGINE_VERSION = "1.0.0";

function evaluateStep(
  problem: ProblemDefinition,
  stepId: string,
  input: StudentStepInput | undefined,
): StepEvaluation {
  const step = problem.solutionGraph.steps[stepId];
  if (!step) {
    throw new Error(`Solution graph references unknown step: ${stepId}`);
  }
  if (!input) {
    return {
      stepId,
      dependencies: step.dependencies,
      status: "INVALID",
      failureCode: "MISSING_STEP",
      message: "Complete this structured step before checking the path.",
      submittedInput: null,
      toolVersions: [],
    };
  }

  const failures = [
    checkNumeric(input, step.expected),
    checkExpression(input, step.expected),
    checkUnit(input, step.expected),
    checkSignificantFigures(input, step.expected),
  ];
  const firstFailure = failures.find((failure) => failure !== null);
  const toolVersions: string[] = [];
  if (step.expected.numericValue !== undefined) {
    toolVersions.push(TOOL_VERSIONS.numeric);
  }
  if (step.expected.expressionVariants !== undefined) {
    toolVersions.push(TOOL_VERSIONS.expression);
  }
  toolVersions.push(TOOL_VERSIONS.unit);
  if (step.expected.significantFigures !== undefined) {
    toolVersions.push(TOOL_VERSIONS.significantFigures);
  }

  return {
    stepId,
    dependencies: step.dependencies,
    status: firstFailure ? "INVALID" : "VALID",
    failureCode: firstFailure?.failureCode ?? null,
    message: firstFailure?.message ?? "This step matches the canonical calculation path.",
    submittedInput: input,
    toolVersions,
  };
}

export function evaluateCalculationPath(
  problem: ProblemDefinition,
  submission: CalculationPathSubmission,
): CalculationEvidenceTrace {
  const stepEvaluations: StepEvaluation[] = [];
  let firstInvalidStepId: string | null = null;
  let failureCode: PathFailureCode = null;

  for (const stepId of problem.solutionGraph.orderedStepIds) {
    if (firstInvalidStepId) {
      const step = problem.solutionGraph.steps[stepId];
      stepEvaluations.push({
        stepId,
        dependencies: step.dependencies,
        status: "NOT_EVALUATED",
        failureCode: null,
        message: "Not evaluated after the first invalid path step.",
        submittedInput: submission.steps[stepId] ?? null,
        toolVersions: [],
      });
      continue;
    }

    const evaluation = evaluateStep(problem, stepId, submission.steps[stepId]);
    stepEvaluations.push(evaluation);
    if (evaluation.status === "INVALID") {
      firstInvalidStepId = stepId;
      failureCode = evaluation.failureCode;
    }
  }

  const decision =
    failureCode === null
      ? "VALID_PATH"
      : failureCode === "MISSING_STEP"
        ? "INCOMPLETE_PATH"
        : "INVALID_PATH";

  return {
    traceId: `${submission.attemptId}:trace`,
    attemptId: submission.attemptId,
    problemDefinitionId: problem.id,
    problemDefinitionVersion: problem.version,
    problemSchemaVersion: problem.schemaVersion,
    solutionGraphVersion: problem.solutionGraph.version,
    engineVersion: CALCULATION_PATH_ENGINE_VERSION,
    decision,
    failureCode,
    firstInvalidStepId,
    stepEvaluations,
    persistenceStatus: "MEMORY_ONLY",
    submittedAt: submission.submittedAt,
  };
}
