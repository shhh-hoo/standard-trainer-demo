import type {
  CalculationEvidenceTrace,
  PathDecision,
  PathFailureCode,
  PersistenceStatus,
  StepEvaluation,
  StepEvaluationStatus,
  StudentStepInput,
} from "./types";

const decisions = new Set<PathDecision>(["VALID_PATH", "INVALID_PATH", "INCOMPLETE_PATH"]);
const failureCodes = new Set<Exclude<PathFailureCode, null>>([
  "MISSING_STEP",
  "NUMERIC_MISMATCH",
  "EXPRESSION_MISMATCH",
  "UNIT_MISMATCH",
  "SIGNIFICANT_FIGURES_MISMATCH",
]);
const evaluationStatuses = new Set<StepEvaluationStatus>([
  "VALID",
  "INVALID",
  "NOT_EVALUATED",
]);
const persistenceStatuses = new Set<PersistenceStatus>([
  "PERSISTED",
  "MEMORY_ONLY",
  "FAILED",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isStudentStepInput(value: unknown): value is StudentStepInput {
  if (!isObject(value)) {
    return false;
  }
  return (
    (value.numericValue === undefined ||
      (typeof value.numericValue === "number" && Number.isFinite(value.numericValue))) &&
    (value.expression === undefined || typeof value.expression === "string") &&
    (value.unit === undefined || typeof value.unit === "string") &&
    (value.significantFigures === undefined ||
      (Number.isInteger(value.significantFigures) && Number(value.significantFigures) > 0))
  );
}

function isStepEvaluation(value: unknown): value is StepEvaluation {
  if (!isObject(value)) {
    return false;
  }
  const failureCodeValid =
    value.failureCode === null ||
    (typeof value.failureCode === "string" &&
      failureCodes.has(value.failureCode as Exclude<PathFailureCode, null>));
  if (
    !isNonEmptyString(value.stepId) ||
    !isStringArray(value.dependencies) ||
    !evaluationStatuses.has(value.status as StepEvaluationStatus) ||
    !failureCodeValid ||
    !isNonEmptyString(value.message) ||
    !(value.submittedInput === null || isStudentStepInput(value.submittedInput)) ||
    !isStringArray(value.toolVersions)
  ) {
    return false;
  }
  if (value.status === "VALID") {
    return value.failureCode === null && value.submittedInput !== null;
  }
  if (value.status === "INVALID") {
    return value.failureCode !== null;
  }
  return value.failureCode === null;
}

function decisionMatchesEvaluations(candidate: CalculationEvidenceTrace): boolean {
  const invalidIndex = candidate.stepEvaluations.findIndex((step) => step.status === "INVALID");
  if (candidate.decision === "VALID_PATH") {
    return (
      candidate.failureCode === null &&
      candidate.firstInvalidStepId === null &&
      candidate.stepEvaluations.every((step) => step.status === "VALID")
    );
  }
  if (invalidIndex < 0 || candidate.firstInvalidStepId === null || candidate.failureCode === null) {
    return false;
  }
  const invalid = candidate.stepEvaluations[invalidIndex];
  const correctDecision =
    candidate.failureCode === "MISSING_STEP"
      ? candidate.decision === "INCOMPLETE_PATH"
      : candidate.decision === "INVALID_PATH";
  return (
    correctDecision &&
    invalid.stepId === candidate.firstInvalidStepId &&
    invalid.failureCode === candidate.failureCode &&
    candidate.stepEvaluations
      .slice(invalidIndex + 1)
      .every((step) => step.status === "NOT_EVALUATED")
  );
}

export function isCalculationEvidenceTrace(value: unknown): value is CalculationEvidenceTrace {
  if (!isObject(value)) {
    return false;
  }
  const failureCodeValid =
    value.failureCode === null ||
    (typeof value.failureCode === "string" &&
      failureCodes.has(value.failureCode as Exclude<PathFailureCode, null>));
  if (
    !isNonEmptyString(value.traceId) ||
    !isNonEmptyString(value.attemptId) ||
    value.problemDefinitionId !== "KP_FROM_EQUILIBRIUM_MOLES" ||
    !isNonEmptyString(value.problemDefinitionVersion) ||
    !isNonEmptyString(value.problemSchemaVersion) ||
    !isNonEmptyString(value.solutionGraphVersion) ||
    !isNonEmptyString(value.engineVersion) ||
    !decisions.has(value.decision as PathDecision) ||
    !failureCodeValid ||
    !(value.firstInvalidStepId === null || isNonEmptyString(value.firstInvalidStepId)) ||
    !Array.isArray(value.stepEvaluations) ||
    value.stepEvaluations.length === 0 ||
    !value.stepEvaluations.every(isStepEvaluation) ||
    !persistenceStatuses.has(value.persistenceStatus as PersistenceStatus) ||
    !isNonEmptyString(value.submittedAt) ||
    !Number.isFinite(Date.parse(value.submittedAt as string))
  ) {
    return false;
  }
  return decisionMatchesEvaluations(value as unknown as CalculationEvidenceTrace);
}
