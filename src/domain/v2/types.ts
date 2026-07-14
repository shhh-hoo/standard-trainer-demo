export const V2_CONTRACT_VERSION = "2.0.0-draft.1" as const;

export type LearnerMode = "TRY_IT_YOURSELF" | "GUIDE_ME";

export type InputModality =
  | "HANDWRITING_IMAGE"
  | "DIGITAL_INK"
  | "TYPED_WORKING"
  | "EXPLANATION"
  | "STRUCTURED";

export type AttemptModality = InputModality | "MIXED";

export type DiagnosisCategory =
  | "DATA_EXTRACTION"
  | "TARGET_IDENTIFICATION"
  | "STRATEGY"
  | "FORMULA"
  | "SUBSTITUTION"
  | "ARITHMETIC"
  | "UNIT"
  | "PRECISION";

export type DiagnosisFailureCode =
  | "RELEVANT_DATA_OMITTED"
  | "IRRELEVANT_DATA_USED"
  | "TARGET_MISIDENTIFIED"
  | "WRONG_METHOD"
  | "MISSING_REASONING_LINK"
  | "UNSUPPORTED_ASSUMPTION"
  | "WRONG_FORMULA"
  | "WRONG_SPECIES"
  | "WRONG_STOICHIOMETRIC_POWER"
  | "INVERTED_RELATION"
  | "WRONG_VALUE_SUBSTITUTED"
  | "WRONG_DEPENDENCY_USED"
  | "ARITHMETIC_ERROR"
  | "UNIT_ERROR"
  | "SIGNIFICANT_FIGURES_ERROR";

export type EvaluationStatus =
  | "CORRECT"
  | "INCORRECT"
  | "AMBIGUOUS_RECOGNITION"
  | "NOT_OBSERVED"
  | "DOWNSTREAM_AFFECTED"
  | "NOT_EVALUATED"
  | "SUPPORTED_BY_HINT";

export type DiagnosisDecision =
  | "SOLVED"
  | "STUDENT_ERROR"
  | "INCOMPLETE_EVIDENCE"
  | "RECOGNITION_UNCERTAIN"
  | "NOT_SOLVED";

export type MasteryOutcome =
  | "SOLVED_INDEPENDENTLY"
  | "SOLVED_AFTER_METACOGNITIVE_PROMPT"
  | "SOLVED_AFTER_STRATEGY_HINT"
  | "SOLVED_AFTER_FORMULA_HINT"
  | "SOLVED_USING_FULL_SCAFFOLD"
  | "NOT_SOLVED_AFTER_FULL_SCAFFOLD"
  | "INSUFFICIENT_EVIDENCE";

export type SemanticType =
  | "DATA_SELECTION"
  | "TARGET_IDENTIFICATION"
  | "STRATEGY"
  | "FORMULA"
  | "SUBSTITUTION"
  | "ARITHMETIC"
  | "UNIT"
  | "FINAL_ANSWER"
  | "UNKNOWN";

export type ChemistryConcept =
  | "TOTAL_MOLES"
  | "MOLE_FRACTION"
  | "PARTIAL_PRESSURE"
  | "KP_EXPRESSION"
  | "KP_RESULT";

export type RecognitionStatus =
  | "CONFIRMED"
  | "ABOVE_AUTHORED_THRESHOLD"
  | "REQUIRES_CONFIRMATION"
  | "ABSTAINED";

export type ReasoningEvidenceKind =
  | "EXPLICIT_STEP"
  | "EMBEDDED_EXPRESSION"
  | "DECLARED_RESULT"
  | "FACT_USE"
  | "TARGET_STATEMENT";

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly coordinateSpace: "NORMALIZED_0_TO_1";
}

export interface AttemptArtifact {
  readonly id: string;
  readonly modality: InputModality;
  readonly mediaType: string;
  readonly pageCount?: number;
  readonly contentRef: string;
}

export interface StepSource {
  readonly artifactId: string;
  readonly modality: InputModality;
  readonly page?: number;
  readonly boundingBox?: BoundingBox;
  readonly textSpan?: string;
}

export interface RecognitionCandidate {
  readonly transcription: string;
  readonly confidence: number;
}

interface RecognitionIssueBase {
  readonly id: string;
  readonly stepId: string;
  readonly source: StepSource;
  readonly reason: "LOW_CONFIDENCE" | "MULTIPLE_PLAUSIBLE_READINGS" | "ILLEGIBLE";
  readonly candidates: readonly RecognitionCandidate[];
}

export type RecognitionIssue = RecognitionIssueBase &
  (
    | { readonly status: "OPEN" }
    | { readonly status: "STUDENT_CONFIRMED"; readonly selectedCandidate: string }
    | { readonly status: "MODEL_ABSTAINED" }
  );

export interface NumberExpression {
  readonly kind: "NUMBER";
  readonly value: number;
  readonly raw: string;
}

export interface VariableExpression {
  readonly kind: "VARIABLE";
  readonly symbol: string;
}

export interface BinaryExpression {
  readonly kind: "BINARY";
  readonly operator: "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE" | "POWER";
  readonly left: ExpressionAst;
  readonly right: ExpressionAst;
}

export interface FunctionExpression {
  readonly kind: "FUNCTION";
  readonly name: "SUM";
  readonly arguments: readonly ExpressionAst[];
}

export type ExpressionAst =
  | NumberExpression
  | VariableExpression
  | BinaryExpression
  | FunctionExpression;

export interface VariableReference {
  readonly symbol: string;
  readonly refersTo: string;
  readonly sourceStepId?: string;
}

export interface FactUse {
  readonly factId: string;
  readonly observedValue: number | string;
  readonly unit?: string;
  readonly evidenceStepIds: readonly string[];
}

export interface TargetInterpretation {
  readonly quantity: "KP";
  readonly evidenceStepIds: readonly string[];
  readonly explicit: boolean;
}

export interface NormalizedStep {
  readonly id: string;
  readonly source: StepSource;
  readonly rawTranscription: string;
  readonly semanticType: SemanticType;
  readonly concept: ChemistryConcept | null;
  readonly expressionAst?: ExpressionAst;
  readonly inputs?: readonly VariableReference[];
  readonly declaredResult?: number;
  readonly unit?: string;
  readonly significantFigures?: number;
  readonly recognitionConfidence: number;
  readonly recognitionStatus: RecognitionStatus;
  readonly ambiguities: readonly RecognitionCandidate[];
  readonly studentConfirmed: boolean;
}

export interface AssistanceEvent {
  readonly stage: DiagnosisCategory;
  readonly level: 1 | 2 | 3 | 4;
  readonly hintId: string;
  readonly trigger: "LEARNER_REQUEST" | "CONSECUTIVE_FAILURES";
  readonly revealedConcepts: readonly string[];
  readonly timestamp: string;
}

export interface NormalizedAttempt {
  readonly schemaVersion: typeof V2_CONTRACT_VERSION;
  readonly attemptId: string;
  readonly problemDefinitionId: string;
  readonly problemDefinitionVersion: string;
  readonly learnerMode: LearnerMode;
  readonly modality: AttemptModality;
  readonly artifacts: readonly AttemptArtifact[];
  readonly factsUsed: readonly FactUse[];
  readonly target: TargetInterpretation | null;
  readonly steps: readonly NormalizedStep[];
  readonly finalAnswer: {
    readonly value?: number;
    readonly unit?: string;
    readonly significantFigures?: number;
  } | null;
  readonly recognitionIssues: readonly RecognitionIssue[];
  readonly assistanceEvents: readonly AssistanceEvent[];
}

export interface AuthoredFact {
  readonly id: string;
  readonly label: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly relevance: "REQUIRED" | "IRRELEVANT";
}

export interface ReasoningNodeDefinition {
  readonly id: string;
  readonly category: DiagnosisCategory;
  readonly concept: ChemistryConcept | null;
  readonly requiredForSolution: boolean;
  readonly explicitWorkingRequired: boolean;
  readonly dependencies: readonly string[];
  readonly acceptableEvidence: readonly ReasoningEvidenceKind[];
}

export interface AcceptedStrategyDefinition {
  readonly id: string;
  readonly label: string;
  readonly requiredNodeIds: readonly string[];
  readonly optionalNodeIds: readonly string[];
}

export interface HintDefinition {
  readonly id: string;
  readonly stage: DiagnosisCategory;
  readonly level: 1 | 2 | 3 | 4;
  readonly reveals: readonly string[];
}

export interface DiagnosticProblemDefinitionV2 {
  readonly schemaVersion: typeof V2_CONTRACT_VERSION;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly prompt: string;
  readonly reaction: string;
  readonly authoredFacts: readonly AuthoredFact[];
  readonly target: {
    readonly quantity: "KP";
    readonly acceptedUnits: readonly string[];
    readonly significantFigures: number;
  };
  readonly reasoningGraph: {
    readonly version: string;
    readonly pedagogicalOrder: readonly string[];
    readonly nodes: Readonly<Record<string, ReasoningNodeDefinition>>;
    readonly acceptedStrategies: readonly AcceptedStrategyDefinition[];
  };
  readonly recognitionPolicy: {
    readonly version: string;
    readonly autoAcceptThreshold: number;
    readonly localConfirmationThreshold: number;
    readonly belowConfirmationThreshold: "ABSTAIN";
  };
  readonly diagnosisPolicyVersion: string;
  readonly hintPolicy: {
    readonly version: string;
    readonly automaticEscalationAfterConsecutiveFailures: number;
    readonly hints: readonly HintDefinition[];
  };
}

export interface ExpectedStageEvaluation {
  readonly category: DiagnosisCategory;
  readonly status: EvaluationStatus;
  readonly failureCode: DiagnosisFailureCode | null;
  readonly evidenceStepIds: readonly string[];
}

export interface ExpectedDiagnosis {
  readonly decision: DiagnosisDecision;
  readonly failureCode: DiagnosisFailureCode | null;
  readonly firstPedagogicalError: DiagnosisCategory | null;
  readonly masteryOutcome: MasteryOutcome;
  readonly stageEvaluations: readonly ExpectedStageEvaluation[];
}

export interface NormalizedAttemptFixture {
  readonly id: string;
  readonly description: string;
  readonly attempt: NormalizedAttempt;
  readonly expected: ExpectedDiagnosis;
}

export interface ReasoningAlignmentEvidence {
  readonly normalizedStepId: string;
  readonly reasoningNodeIds: readonly string[];
  readonly confidence: number;
  readonly basis: "EXPLICIT" | "EMBEDDED" | "INFERRED";
}

export interface DeterministicCheckEvidence {
  readonly category: DiagnosisCategory;
  readonly stepIds: readonly string[];
  readonly toolVersion: string;
  readonly outcome: "PASS" | "FAIL" | "NOT_RUN";
  readonly failureCode: DiagnosisFailureCode | null;
}

export interface DiagnosticEvidenceTraceV2 {
  readonly schemaVersion: typeof V2_CONTRACT_VERSION;
  readonly traceId: string;
  readonly attemptId: string;
  readonly problemDefinitionId: string;
  readonly problemDefinitionVersion: string;
  readonly reasoningGraphVersion: string;
  readonly diagnosisPolicyVersion: string;
  readonly recognitionPolicyVersion: string;
  readonly hintPolicyVersion: string;
  readonly interpreter: {
    readonly kind: "STRUCTURED_ADAPTER" | "TYPED_WORKING_MOCK" | "MULTIMODAL_MODEL";
    readonly adapterVersion?: string;
    readonly modelVersion?: string;
    readonly promptVersion?: string;
  };
  readonly recognitionDecision: RecognitionStatus;
  readonly recognitionIssues: readonly RecognitionIssue[];
  readonly alignmentEvidence: readonly ReasoningAlignmentEvidence[];
  readonly deterministicChecks: readonly DeterministicCheckEvidence[];
  readonly stageEvaluations: readonly ExpectedStageEvaluation[];
  readonly decision: DiagnosisDecision;
  readonly failureCode: DiagnosisFailureCode | null;
  readonly firstPedagogicalError: DiagnosisCategory | null;
  readonly assistanceEvents: readonly AssistanceEvent[];
  readonly masteryOutcome: MasteryOutcome;
  readonly submittedAt: string;
}
