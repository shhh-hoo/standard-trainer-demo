export type DiagnosticTargetKind = "KP" | "KC" | "AMOUNT" | "MASS" | "CONCENTRATION" | "VOLUME" | "PH" | "OTHER_BOUNDED";
export type DiagnosisCategory = "DATA_EXTRACTION" | "TARGET_IDENTIFICATION" | "STRATEGY" | "FORMULA" | "SUBSTITUTION" | "ARITHMETIC" | "UNIT" | "PRECISION";
export type DiagnosisFailureCode = "RELEVANT_DATA_OMITTED" | "IRRELEVANT_DATA_USED" | "TARGET_MISIDENTIFIED" | "WRONG_METHOD" | "MISSING_REASONING_LINK" | "WRONG_FORMULA" | "WRONG_STOICHIOMETRIC_RATIO" | "WRONG_VALUE_SUBSTITUTED" | "ARITHMETIC_ERROR" | "UNIT_ERROR" | "SIGNIFICANT_FIGURES_ERROR";

export type ExpressionAst =
  | { readonly kind: "NUMBER"; readonly value: number; readonly raw: string }
  | { readonly kind: "VARIABLE"; readonly reference: { readonly source: "AUTHORED_FACT"; readonly factId: string; readonly symbol: string } | { readonly source: "REASONING_QUANTITY"; readonly reasoningNodeId: string; readonly symbol: string } }
  | { readonly kind: "BINARY"; readonly operator: "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE" | "POWER"; readonly left: ExpressionAst; readonly right: ExpressionAst }
  | { readonly kind: "FUNCTION"; readonly name: "SUM"; readonly arguments: readonly ExpressionAst[] };

export interface PublishedDiagnosticLearningComponent {
  readonly schemaVersion: string;
  readonly id: string;
  readonly version: string;
  readonly status: "PUBLISHED";
  readonly curriculum: { readonly board: "CAIE"; readonly syllabusCode: "9701"; readonly subject: "Chemistry"; readonly topic: string; readonly learningObjectiveId: string; readonly learningObjectiveText: string; readonly sourceIds: readonly string[] };
  readonly presentation: { readonly title: string; readonly prompt: string; readonly reaction?: string; readonly marks: number };
  readonly authoredFacts: readonly { readonly id: string; readonly label: string; readonly value: number | string; readonly unit?: string; readonly relevance: "REQUIRED" | "IRRELEVANT" }[];
  readonly target: { readonly kind: DiagnosticTargetKind; readonly expectedValue: number; readonly acceptedUnits: readonly string[]; readonly significantFigures: number; readonly absoluteTolerance: number; readonly resultReasoningNodeId: string };
  readonly formulaDefinitions: readonly { readonly id: string; readonly targetReasoningNodeId: string; readonly expression: ExpressionAst }[];
  readonly reasoningGraph: { readonly version: string; readonly pedagogicalOrder: readonly string[]; readonly nodes: Readonly<Record<string, { readonly id: string; readonly label: string; readonly category: DiagnosisCategory; readonly concept: string | null; readonly dependencies: readonly string[]; readonly solutionEvidenceKinds: readonly string[] }>>; readonly acceptedStrategies: readonly { readonly id: string; readonly label: string; readonly nodeRequirements: readonly { readonly nodeId: string; readonly requirement: "REQUIRED" | "OPTIONAL"; readonly allowedEvidenceKinds: readonly string[] }[] }[] };
  readonly diagnosisPolicy: { readonly version: string; readonly categoryOrder: readonly DiagnosisCategory[]; readonly supportedFailureCodes: readonly DiagnosisFailureCode[] };
  readonly hintPolicy: { readonly version: string; readonly automaticEscalationAfterConsecutiveFailures: number; readonly hints: readonly { readonly id: string; readonly stage: DiagnosisCategory; readonly level: 1 | 2 | 3 | 4; readonly text: string; readonly revealedReasoningNodeIds: readonly string[] }[] };
  readonly markScheme: readonly { readonly id: string; readonly reasoningNodeId: string; readonly description: string; readonly marks: number }[];
  readonly provenance:
    | { readonly origin: "MIGRATED"; readonly sourceComponentId: string }
    | { readonly origin: "AI_GENERATED"; readonly generatorId: string; readonly promptVersion: string; readonly generatedAt: string }
    | { readonly origin: "EXPERT_AUTHORED" };
  readonly migration?: { readonly fidelity: "LOSSLESS" | "SIMPLIFIED"; readonly sourceContractVersion?: string; readonly omittedCapabilities: readonly string[] };
  readonly review: { readonly reviewer: string; readonly reviewedAt: string; readonly notes: string };
  readonly publication: { readonly publishedAt: string; readonly publishedBy: string; readonly contentHash: string };
}

export interface RuntimeCapabilityProfile {
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly supportedSchemaVersions: readonly string[];
  readonly supportedTargetKinds: readonly DiagnosticTargetKind[];
  readonly supportedExpressionNodes: readonly string[];
  readonly supportedDiagnosisCategories: readonly DiagnosisCategory[];
  readonly supportedFailureCodes: readonly DiagnosisFailureCode[];
  readonly limitations: readonly string[];
}

export interface NormalizedAttempt {
  readonly attemptId: string;
  readonly componentId: string;
  readonly componentVersion: string;
  readonly strategyId: string;
  readonly evidencedReasoningNodeIds: readonly string[];
  readonly substitutedFacts: Readonly<Record<string, number>>;
  readonly stoichiometricRatio?: number;
  readonly arithmeticWorkingValue?: number;
  readonly finalAnswer: { readonly value: number; readonly unit: string; readonly significantFigures: number };
}

export interface DiagnosisContext { readonly traceId: string; readonly submittedAt: string; }
export interface LearnerEvidenceTrace {
  readonly traceId: string;
  readonly attemptId: string;
  readonly componentId: string;
  readonly componentVersion: string;
  readonly componentContentHash: string;
  readonly runtimeVersion: string;
  readonly decision: "SOLVED" | "STUDENT_ERROR" | "INCOMPLETE_EVIDENCE";
  readonly failureCode: DiagnosisFailureCode | null;
  readonly firstPedagogicalError: DiagnosisCategory | null;
  readonly evidence: readonly string[];
  readonly submittedAt: string;
}

export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly issues: readonly { readonly path: string; readonly code: string; readonly message: string }[] };
export type DiagnosisEngineResult = { readonly ok: true; readonly trace: LearnerEvidenceTrace } | { readonly ok: false; readonly kind: "INVALID_COMPONENT" | "INVALID_ATTEMPT" | "UNSUPPORTED_TARGET"; readonly issues: readonly { readonly path: string; readonly code: string; readonly message: string }[] };

export interface DiagnosticTargetAdapter {
  readonly targetKind: DiagnosticTargetKind;
  validateComponent(component: PublishedDiagnosticLearningComponent): ValidationResult;
  evaluateAttempt(component: PublishedDiagnosticLearningComponent, attempt: NormalizedAttempt, context: DiagnosisContext): DiagnosisEngineResult;
}

export interface PublishedComponentRegistry {
  list(): readonly PublishedDiagnosticLearningComponent[];
  get(componentId: string, version?: string): PublishedDiagnosticLearningComponent | null;
}
