export type PathDecision = "VALID_PATH" | "INVALID_PATH" | "INCOMPLETE_PATH";

export type PathFailureCode =
  | "MISSING_STEP"
  | "NUMERIC_MISMATCH"
  | "EXPRESSION_MISMATCH"
  | "UNIT_MISMATCH"
  | "SIGNIFICANT_FIGURES_MISMATCH"
  | null;

export type StepEvaluationStatus = "VALID" | "INVALID" | "NOT_EVALUATED";
export type PersistenceStatus = "PERSISTED" | "MEMORY_ONLY" | "FAILED";

export interface StudentStepInput {
  readonly numericValue?: number;
  readonly expression?: string;
  readonly unit?: string;
  readonly significantFigures?: number;
}

export interface ExpectedStepValue {
  readonly numericValue?: number;
  readonly absoluteTolerance?: number;
  readonly expressionVariants?: readonly string[];
  readonly acceptedUnits: readonly string[];
  readonly significantFigures?: number;
}

export interface SolutionStepDefinition {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
  readonly dependencies: readonly string[];
  readonly expected: ExpectedStepValue;
}

export interface CanonicalSolutionGraph {
  readonly version: string;
  readonly orderedStepIds: readonly string[];
  readonly steps: Readonly<Record<string, SolutionStepDefinition>>;
}

export interface ProblemDefinition {
  readonly schemaVersion: string;
  readonly id: "KP_FROM_EQUILIBRIUM_MOLES";
  readonly version: string;
  readonly title: string;
  readonly prompt: string;
  readonly reaction: string;
  readonly givens: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly solutionGraph: CanonicalSolutionGraph;
}

export interface CalculationPathSubmission {
  readonly attemptId: string;
  readonly submittedAt: string;
  readonly steps: Readonly<Record<string, StudentStepInput>>;
}

export interface StepEvaluation {
  readonly stepId: string;
  readonly dependencies: readonly string[];
  readonly status: StepEvaluationStatus;
  readonly failureCode: PathFailureCode;
  readonly message: string;
  readonly submittedInput: StudentStepInput | null;
  readonly toolVersions: readonly string[];
}

export interface CalculationEvidenceTrace {
  readonly traceId: string;
  readonly attemptId: string;
  readonly problemDefinitionId: ProblemDefinition["id"];
  readonly problemDefinitionVersion: string;
  readonly problemSchemaVersion: string;
  readonly solutionGraphVersion: string;
  readonly engineVersion: string;
  readonly decision: PathDecision;
  readonly failureCode: PathFailureCode;
  readonly firstInvalidStepId: string | null;
  readonly stepEvaluations: readonly StepEvaluation[];
  readonly persistenceStatus: PersistenceStatus;
  readonly submittedAt: string;
}
