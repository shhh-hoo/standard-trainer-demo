export const V2_CONTRACT_VERSION = "2.0.0-draft.2" as const;

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

export type AttemptSupportOutcome =
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

export type ReasoningEvidenceKind =
  | "EXPLICIT_STEP"
  | "FORMULA_AST"
  | "EQUATION"
  | "DECLARED_RESULT"
  | "FACT_USE"
  | "TARGET_STATEMENT"
  | "EMBEDDED_CALCULATION"
  | "INFERRED";

export type RecognitionGateDecision =
  | "PASSED"
  | "REQUIRES_CONFIRMATION"
  | "ABSTAINED";

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

export interface HandwritingImageSource {
  readonly artifactId: string;
  readonly modality: "HANDWRITING_IMAGE";
  readonly page: number;
  readonly boundingBox: BoundingBox;
}

export interface DigitalInkSource {
  readonly artifactId: string;
  readonly modality: "DIGITAL_INK";
  readonly page: number;
  readonly boundingBox: BoundingBox;
}

export interface TextSource {
  readonly artifactId: string;
  readonly modality: "TYPED_WORKING" | "EXPLANATION" | "STRUCTURED";
  readonly textSpan: string;
}

export type VisualStepSource = HandwritingImageSource | DigitalInkSource;
export type StepSource = VisualStepSource | TextSource;

export interface RecognitionCandidate {
  readonly transcription: string;
  readonly confidence: number;
}

export type RecognitionEvidence =
  | {
      readonly status: "AUTO_ACCEPTED";
      readonly confidence: number;
    }
  | {
      readonly status: "STUDENT_CONFIRMED";
      readonly confidence: number;
      readonly selectedTranscription: string;
      readonly candidates: readonly RecognitionCandidate[];
    }
  | {
      readonly status: "REQUIRES_CONFIRMATION";
      readonly confidence: number;
      readonly candidates: readonly RecognitionCandidate[];
    }
  | {
      readonly status: "ABSTAINED";
      readonly confidence: number;
      readonly reason: string;
    };

interface RecognitionIssueBase {
  readonly id: string;
  readonly reason:
    | "LOW_CONFIDENCE"
    | "MULTIPLE_PLAUSIBLE_READINGS"
    | "ILLEGIBLE"
    | "CROP_INVALID"
    | "STEP_BOUNDARY_UNCERTAIN";
}

export type RecognitionIssue = RecognitionIssueBase &
  (
    | {
        readonly scope: "ARTIFACT";
        readonly artifactId: string;
        readonly recognition: Extract<RecognitionEvidence, { readonly status: "ABSTAINED" }>;
      }
    | {
        readonly scope: "REGION";
        readonly source: VisualStepSource;
        readonly recognition: Exclude<
          RecognitionEvidence,
          { readonly status: "AUTO_ACCEPTED" }
        >;
      }
    | {
        readonly scope: "STEP";
        readonly stepId: string;
      }
  );

export type VariableReference =
  | {
      readonly source: "AUTHORED_FACT";
      readonly symbol: string;
      readonly factId: string;
    }
  | {
      readonly source: "NORMALIZED_STEP_RESULT";
      readonly symbol: string;
      readonly stepId: string;
    }
  | {
      readonly source: "REASONING_QUANTITY";
      readonly symbol: string;
      readonly reasoningNodeId: string;
    };

export interface NumberExpression {
  readonly kind: "NUMBER";
  readonly value: number;
  readonly raw: string;
}

export interface VariableExpression {
  readonly kind: "VARIABLE";
  readonly reference: VariableReference;
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

export interface QuantityValue {
  readonly value: number;
  readonly unit?: string;
  readonly significantFigures?: number;
  readonly raw?: string;
}

export interface EquationEvidence {
  readonly target: VariableReference;
  readonly expression: ExpressionAst;
  readonly declaredResult?: QuantityValue;
}

export interface FactUse {
  readonly factId: string;
  readonly observedValue: number | string;
  readonly unit?: string;
  readonly evidenceStepIds: readonly string[];
}

export interface TargetInterpretation {
  readonly quantity: "KP" | "KC" | "OTHER";
  readonly evidenceStepIds: readonly string[];
  readonly explicit: boolean;
}

export interface NormalizedStep {
  readonly id: string;
  readonly revisionId: string;
  readonly source: StepSource;
  readonly rawTranscription: string;
  readonly semanticType: SemanticType;
  readonly concept: ChemistryConcept | null;
  readonly formulaAst?: ExpressionAst;
  readonly calculation?: EquationEvidence;
  readonly recognition: RecognitionEvidence;
}

export interface AssistanceEvent {
  readonly id: string;
  readonly sequence: number;
  readonly stage: DiagnosisCategory;
  readonly level: 1 | 2 | 3 | 4;
  readonly hintId: string;
  readonly trigger: "LEARNER_REQUEST" | "CONSECUTIVE_FAILURES";
  readonly revealedReasoningNodeIds: readonly string[];
  readonly revealedContentIds: readonly string[];
  readonly timestamp: string;
}

export interface AttemptRevision {
  readonly id: string;
  readonly sequence: number;
  readonly submittedAt: string;
  readonly stepIds: readonly string[];
  readonly precededByAssistanceEventIds: readonly string[];
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
  readonly revisions: readonly AttemptRevision[];
  readonly finalAnswer: QuantityValue | null;
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
  readonly dependencies: readonly string[];
  readonly solutionEvidenceKinds: readonly ReasoningEvidenceKind[];
  readonly independentStageEvidenceKinds: readonly ReasoningEvidenceKind[];
}

export interface StrategyNodeRequirement {
  readonly nodeId: string;
  readonly requirement: "REQUIRED" | "OPTIONAL";
  readonly allowedEvidenceKinds: readonly ReasoningEvidenceKind[];
}

export interface AcceptedStrategyDefinition {
  readonly id: string;
  readonly label: string;
  readonly nodeRequirements: readonly StrategyNodeRequirement[];
}

export interface HintDefinition {
  readonly id: string;
  readonly stage: DiagnosisCategory;
  readonly level: 1 | 2 | 3 | 4;
  readonly revealedReasoningNodeIds: readonly string[];
  readonly revealedContentIds: readonly string[];
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
  readonly formulaDefinitions: readonly {
    readonly id: string;
    readonly targetReasoningNodeId: string;
    readonly expression: ExpressionAst;
  }[];
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
  readonly recognitionGateDecision: RecognitionGateDecision;
  readonly decision: DiagnosisDecision;
  readonly failureCode: DiagnosisFailureCode | null;
  readonly firstPedagogicalError: DiagnosisCategory | null;
  readonly attemptSupportOutcome: AttemptSupportOutcome;
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
  readonly evidenceKind: ReasoningEvidenceKind;
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
  readonly recognitionGateDecision: RecognitionGateDecision;
  readonly recognitionIssues: readonly RecognitionIssue[];
  readonly alignmentEvidence: readonly ReasoningAlignmentEvidence[];
  readonly deterministicChecks: readonly DeterministicCheckEvidence[];
  readonly stageEvaluations: readonly ExpectedStageEvaluation[];
  readonly decision: DiagnosisDecision;
  readonly failureCode: DiagnosisFailureCode | null;
  readonly firstPedagogicalError: DiagnosisCategory | null;
  readonly assistanceEvents: readonly AssistanceEvent[];
  readonly revisions: readonly AttemptRevision[];
  readonly attemptSupportOutcome: AttemptSupportOutcome;
  readonly submittedAt: string;
}
