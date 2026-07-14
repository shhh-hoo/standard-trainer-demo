export type Decision = "PASS" | "REWRITE" | "REVIEW" | "UNAVAILABLE";

export type FailureCode =
  | "STANDARD_NOT_FOUND"
  | "WRONG_CURRICULUM"
  | "STALE_STANDARD"
  | "SOURCE_CONFLICT"
  | "LEGACY_REFERENCE_CONFLICT"
  | "MISSING_REQUIRED_ELEMENT"
  | "DANGEROUS_CLAIM"
  | null;

export type SourceStatus = "AI_DRAFT" | "SOURCE_BACKED" | "EXPERT_REVIEWED" | "FLAGGED";
export type ReviewerStatus = "not_reviewed" | "review_pending" | "expert_reviewed" | "flagged";
export type AuthorityScope = "DRAFT_RUBRIC_ONLY" | "SOURCE_BACKED" | "EXPERT_REVIEWED";
export type PersistenceStatus = "PERSISTED" | "MEMORY_ONLY" | "FAILED";

export interface FixtureProvenance {
  readonly id: string;
  readonly legacyItemIds: readonly string[];
  readonly repository: string;
  readonly commitSha: string;
  readonly filePath: string;
  readonly gitBlobSha: string;
  readonly snapshotGeneratedAt: string;
  readonly sourceStatus: SourceStatus;
  readonly transformationNote: string;
}

export interface AlgorithmProvenance {
  readonly id: string;
  readonly repository: string;
  readonly commitSha: string;
  readonly filePath: string;
  readonly gitBlobSha: string;
  readonly snapshotGeneratedAt: string;
  readonly transformationNote: string;
}

export interface LegacyRuntimeContext {
  readonly stage?: unknown;
  readonly levelId?: unknown;
  readonly level?: unknown;
  readonly topicSlug?: unknown;
  readonly topic?: unknown;
  readonly fileId?: unknown;
  readonly packId?: unknown;
  readonly sourceId?: unknown;
  readonly canonicalSourceId?: unknown;
  readonly id?: unknown;
  readonly kind?: unknown;
  readonly type?: unknown;
  readonly round?: unknown;
  readonly blankIndex?: unknown;
  readonly duplicateKey?: unknown;
}

export interface LegacyMemorisationItem {
  readonly id: string;
  readonly stage: string;
  readonly level: number;
  readonly topic: string;
  readonly subtopic: string;
  readonly type: string;
  readonly prompt: string;
  readonly answer: string;
  readonly sourceScope?: string;
  readonly runtimeContext: LegacyRuntimeContext;
  readonly provenanceId: string;
}

export interface RubricElement {
  readonly id: string;
  readonly description: string;
  readonly required: boolean;
  readonly acceptedPatterns: readonly string[];
  readonly sourceIds: readonly string[];
}

export interface DangerousClaim {
  readonly id: string;
  readonly label: string;
  readonly reason: string;
  readonly boundaryError: string;
  readonly patterns: readonly string[];
  readonly sourceIds: readonly string[];
}

export interface StandardNode {
  readonly id: string;
  readonly concept: string;
  readonly prompt: string;
  readonly legacyContentIds: readonly string[];
  readonly board: string;
  readonly syllabusCode: string;
  readonly syllabusCycle: string;
  readonly topic: string;
  readonly version: string;
  readonly rubricVersion: string;
  readonly deterministicRuleVersion: string;
  readonly requirementSummary: string;
  readonly referenceAnswer: string;
  readonly requiredElements: readonly RubricElement[];
  readonly dangerousClaims: readonly DangerousClaim[];
  readonly sourceStatus: SourceStatus;
  readonly reviewerStatus: ReviewerStatus;
  readonly sourceIds: readonly string[];
}

export interface EvidenceMetadata {
  readonly sourceIds: readonly string[];
  readonly hasValidSourceConflict: boolean;
}

export interface ActiveStandard {
  readonly node: StandardNode;
  readonly evidence: EvidenceMetadata;
  readonly legacyReferences: readonly LegacyMemorisationItem[];
}

export interface CurriculumContext {
  readonly board: string;
  readonly syllabusCode: string;
  readonly syllabusCycle: string;
}

export interface JudgementResult {
  readonly decision: Decision;
  readonly failureCode: FailureCode;
  readonly authorityScope: AuthorityScope;
  readonly sourceStatus: SourceStatus;
  readonly reviewerStatus: ReviewerStatus;
  readonly satisfiedElementIds: readonly string[];
  readonly missingElementIds: readonly string[];
  readonly dangerousClaimIds: readonly string[];
  readonly boundaryErrors: readonly string[];
  readonly feedbackItems: readonly {
    readonly elementId: string | null;
    readonly reason: string;
    readonly sourceIds: readonly string[];
  }[];
  readonly reviewReasons: readonly string[];
  readonly scoringPerformed: boolean;
  readonly standardNodeVersion: string;
  readonly rubricVersion: string;
  readonly deterministicRuleVersion: string;
  readonly sourceIds: readonly string[];
}

export interface EvidenceTrace {
  readonly traceId: string;
  readonly attemptId: string;
  readonly standardNodeId: string;
  readonly standardNodeVersion: string;
  readonly rubricVersion: string;
  readonly deterministicRuleVersion: string;
  readonly sourceIds: readonly string[];
  readonly sourceStatus: SourceStatus;
  readonly reviewerStatus: ReviewerStatus;
  readonly authorityScope: AuthorityScope;
  readonly persistenceStatus: PersistenceStatus;
  readonly firstJudgement: JudgementResult;
  readonly secondJudgement: JudgementResult | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AttemptRecord {
  readonly attemptId: string;
  readonly legacyItemId: string;
  readonly legacyCanonicalContentId: string;
  readonly standardNodeId: string;
  readonly standardNodeVersion: string;
  readonly rubricVersion: string;
  readonly deterministicRuleVersion: string;
  readonly sourceIds: readonly string[];
  readonly sourceStatus: SourceStatus;
  readonly reviewerStatus: ReviewerStatus;
  readonly authorityScope: AuthorityScope;
  readonly firstResponse: string;
  readonly firstJudgement: JudgementResult;
  readonly rewrite: string | null;
  readonly secondJudgement: JudgementResult | null;
  readonly referenceRevealedAt: string | null;
  readonly status: "AWAITING_REWRITE" | "COMPLETE" | "HELD";
  readonly persistenceStatus: PersistenceStatus;
  readonly trace: EvidenceTrace;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegacyProgressRecord {
  readonly canonicalContentId: string;
  readonly status: "unseen" | "learning" | "reviewing" | "mastered";
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly nextReviewAt: string | null;
}

export interface LegacyProgressSnapshot {
  readonly version: 1;
  readonly snapshotGeneratedAt: string;
  readonly records: Readonly<Record<string, LegacyProgressRecord>>;
}

export interface LegacyIdentityMapping {
  readonly legacyItemId: string;
  readonly legacyCanonicalContentId: string;
  readonly standardNodeId: string | null;
  readonly migrationNotes: string;
}
