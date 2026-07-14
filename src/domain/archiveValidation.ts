import type {
  AttemptRecord,
  AuthorityScope,
  Decision,
  EvidenceTrace,
  FailureCode,
  JudgementResult,
  PersistenceStatus,
  ReviewerStatus,
  SourceStatus,
} from "./types";

export interface ArchivePayload {
  readonly version: 1;
  readonly attempts: readonly AttemptRecord[];
}

const decisions = new Set<Decision>(["PASS", "REWRITE", "REVIEW", "UNAVAILABLE"]);
const failureCodes = new Set<Exclude<FailureCode, null>>([
  "STANDARD_NOT_FOUND",
  "WRONG_CURRICULUM",
  "STALE_STANDARD",
  "SOURCE_CONFLICT",
  "LEGACY_REFERENCE_CONFLICT",
  "MISSING_REQUIRED_ELEMENT",
  "DANGEROUS_CLAIM",
]);
const sourceStatuses = new Set<SourceStatus>([
  "AI_DRAFT",
  "SOURCE_BACKED",
  "EXPERT_REVIEWED",
  "FLAGGED",
]);
const reviewerStatuses = new Set<ReviewerStatus>([
  "not_reviewed",
  "review_pending",
  "expert_reviewed",
  "flagged",
]);
const authorityScopes = new Set<AuthorityScope>([
  "DRAFT_RUBRIC_ONLY",
  "SOURCE_BACKED",
  "EXPERT_REVIEWED",
]);
const persistenceStatuses = new Set<PersistenceStatus>([
  "PERSISTED",
  "MEMORY_ONLY",
  "FAILED",
]);
const attemptStatuses = new Set<AttemptRecord["status"]>([
  "AWAITING_REWRITE",
  "COMPLETE",
  "HELD",
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

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function equalStringArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function expectedAuthorityScope(sourceStatus: SourceStatus): AuthorityScope {
  if (sourceStatus === "EXPERT_REVIEWED") {
    return "EXPERT_REVIEWED";
  }
  if (sourceStatus === "SOURCE_BACKED") {
    return "SOURCE_BACKED";
  }
  return "DRAFT_RUBRIC_ONLY";
}

function isFeedbackItem(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  return (
    (value.elementId === null || typeof value.elementId === "string") &&
    isNonEmptyString(value.reason) &&
    isStringArray(value.sourceIds)
  );
}

function decisionAndFailureAreConsistent(candidate: Record<string, unknown>): boolean {
  const decision = candidate.decision as Decision;
  const failureCode = candidate.failureCode as FailureCode;

  if (decision === "PASS") {
    return (
      failureCode === null &&
      candidate.scoringPerformed === true &&
      (candidate.missingElementIds as string[]).length === 0 &&
      (candidate.dangerousClaimIds as string[]).length === 0
    );
  }

  if (decision === "REWRITE") {
    if (candidate.scoringPerformed !== true) {
      return false;
    }
    if (failureCode === "MISSING_REQUIRED_ELEMENT") {
      return (candidate.missingElementIds as string[]).length > 0;
    }
    if (failureCode === "DANGEROUS_CLAIM") {
      return (candidate.dangerousClaimIds as string[]).length > 0;
    }
    return false;
  }

  if (decision === "REVIEW") {
    return (
      candidate.scoringPerformed === false &&
      (failureCode === "SOURCE_CONFLICT" || failureCode === "LEGACY_REFERENCE_CONFLICT") &&
      (candidate.reviewReasons as string[]).includes(failureCode)
    );
  }

  return (
    candidate.scoringPerformed === false &&
    (failureCode === "STANDARD_NOT_FOUND" ||
      failureCode === "WRONG_CURRICULUM" ||
      failureCode === "STALE_STANDARD") &&
    (candidate.reviewReasons as string[]).includes(failureCode)
  );
}

export function isJudgementResult(value: unknown): value is JudgementResult {
  if (!isObject(value)) {
    return false;
  }

  const failureCodeIsValid =
    value.failureCode === null ||
    (typeof value.failureCode === "string" && failureCodes.has(value.failureCode as Exclude<FailureCode, null>));
  const arraysAreValid =
    isStringArray(value.satisfiedElementIds) &&
    isStringArray(value.missingElementIds) &&
    isStringArray(value.dangerousClaimIds) &&
    isStringArray(value.boundaryErrors) &&
    isStringArray(value.reviewReasons) &&
    isStringArray(value.sourceIds);

  if (
    !decisions.has(value.decision as Decision) ||
    !failureCodeIsValid ||
    !sourceStatuses.has(value.sourceStatus as SourceStatus) ||
    !reviewerStatuses.has(value.reviewerStatus as ReviewerStatus) ||
    !authorityScopes.has(value.authorityScope as AuthorityScope) ||
    typeof value.scoringPerformed !== "boolean" ||
    !isNonEmptyString(value.standardNodeVersion) ||
    !isNonEmptyString(value.rubricVersion) ||
    !isNonEmptyString(value.deterministicRuleVersion) ||
    !arraysAreValid ||
    !Array.isArray(value.feedbackItems) ||
    !value.feedbackItems.every(isFeedbackItem)
  ) {
    return false;
  }

  if (value.authorityScope !== expectedAuthorityScope(value.sourceStatus as SourceStatus)) {
    return false;
  }

  return decisionAndFailureAreConsistent(value);
}

export function isEvidenceTrace(value: unknown): value is EvidenceTrace {
  if (!isObject(value)) {
    return false;
  }

  return Boolean(
    isNonEmptyString(value.traceId) &&
      isNonEmptyString(value.attemptId) &&
      isNonEmptyString(value.standardNodeId) &&
      isNonEmptyString(value.standardNodeVersion) &&
      isNonEmptyString(value.rubricVersion) &&
      isNonEmptyString(value.deterministicRuleVersion) &&
      isStringArray(value.sourceIds) &&
      sourceStatuses.has(value.sourceStatus as SourceStatus) &&
      reviewerStatuses.has(value.reviewerStatus as ReviewerStatus) &&
      authorityScopes.has(value.authorityScope as AuthorityScope) &&
      persistenceStatuses.has(value.persistenceStatus as PersistenceStatus) &&
      isJudgementResult(value.firstJudgement) &&
      (value.secondJudgement === null || isJudgementResult(value.secondJudgement)) &&
      isIsoTimestamp(value.createdAt) &&
      isIsoTimestamp(value.updatedAt) &&
      Date.parse(value.updatedAt as string) >= Date.parse(value.createdAt as string)
  );
}

function judgementsMatch(left: JudgementResult | null, right: JudgementResult | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function judgementMetadataMatches(
  left: JudgementResult,
  right: JudgementResult,
): boolean {
  return (
    left.standardNodeVersion === right.standardNodeVersion &&
    left.rubricVersion === right.rubricVersion &&
    left.deterministicRuleVersion === right.deterministicRuleVersion &&
    left.sourceStatus === right.sourceStatus &&
    left.reviewerStatus === right.reviewerStatus &&
    left.authorityScope === right.authorityScope &&
    equalStringArrays(left.sourceIds, right.sourceIds)
  );
}

function attemptStatusIsConsistent(candidate: AttemptRecord): boolean {
  const firstDecision = candidate.firstJudgement.decision;

  if (firstDecision === "REWRITE") {
    if (candidate.secondJudgement === null) {
      return candidate.status === "AWAITING_REWRITE" && candidate.rewrite === null;
    }

    const secondHeld =
      candidate.secondJudgement.decision === "REVIEW" ||
      candidate.secondJudgement.decision === "UNAVAILABLE";
    return (
      isNonEmptyString(candidate.rewrite) &&
      candidate.status === (secondHeld ? "HELD" : "COMPLETE")
    );
  }

  if (candidate.rewrite !== null || candidate.secondJudgement !== null) {
    return false;
  }

  if (firstDecision === "PASS") {
    return candidate.status === "COMPLETE";
  }

  return candidate.status === "HELD";
}

export function isAttemptRecord(value: unknown): value is AttemptRecord {
  if (!isObject(value)) {
    return false;
  }

  if (
    !isNonEmptyString(value.attemptId) ||
    !isNonEmptyString(value.legacyItemId) ||
    !isNonEmptyString(value.legacyCanonicalContentId) ||
    !isNonEmptyString(value.standardNodeId) ||
    !isNonEmptyString(value.standardNodeVersion) ||
    !isNonEmptyString(value.rubricVersion) ||
    !isNonEmptyString(value.deterministicRuleVersion) ||
    !isStringArray(value.sourceIds) ||
    !sourceStatuses.has(value.sourceStatus as SourceStatus) ||
    !reviewerStatuses.has(value.reviewerStatus as ReviewerStatus) ||
    !authorityScopes.has(value.authorityScope as AuthorityScope) ||
    !isNonEmptyString(value.firstResponse) ||
    !isJudgementResult(value.firstJudgement) ||
    !(value.rewrite === null || typeof value.rewrite === "string") ||
    !(value.secondJudgement === null || isJudgementResult(value.secondJudgement)) ||
    !(value.referenceRevealedAt === null || isIsoTimestamp(value.referenceRevealedAt)) ||
    !attemptStatuses.has(value.status as AttemptRecord["status"]) ||
    !persistenceStatuses.has(value.persistenceStatus as PersistenceStatus) ||
    !isEvidenceTrace(value.trace) ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.updatedAt) ||
    Date.parse(value.updatedAt) < Date.parse(value.createdAt)
  ) {
    return false;
  }

  const candidate = value as unknown as AttemptRecord;
  const trace = candidate.trace;
  const metadataIsConsistent =
    candidate.standardNodeVersion === candidate.firstJudgement.standardNodeVersion &&
    candidate.rubricVersion === candidate.firstJudgement.rubricVersion &&
    candidate.deterministicRuleVersion === candidate.firstJudgement.deterministicRuleVersion &&
    candidate.sourceStatus === candidate.firstJudgement.sourceStatus &&
    candidate.reviewerStatus === candidate.firstJudgement.reviewerStatus &&
    candidate.authorityScope === candidate.firstJudgement.authorityScope &&
    equalStringArrays(candidate.sourceIds, candidate.firstJudgement.sourceIds) &&
    trace.attemptId === candidate.attemptId &&
    trace.standardNodeId === candidate.standardNodeId &&
    trace.standardNodeVersion === candidate.standardNodeVersion &&
    trace.rubricVersion === candidate.rubricVersion &&
    trace.deterministicRuleVersion === candidate.deterministicRuleVersion &&
    trace.sourceStatus === candidate.sourceStatus &&
    trace.reviewerStatus === candidate.reviewerStatus &&
    trace.authorityScope === candidate.authorityScope &&
    trace.persistenceStatus === candidate.persistenceStatus &&
    equalStringArrays(trace.sourceIds, candidate.sourceIds) &&
    trace.createdAt === candidate.createdAt &&
    trace.updatedAt === candidate.updatedAt &&
    judgementsMatch(trace.firstJudgement, candidate.firstJudgement) &&
    judgementsMatch(trace.secondJudgement, candidate.secondJudgement) &&
    (candidate.secondJudgement === null ||
      judgementMetadataMatches(candidate.firstJudgement, candidate.secondJudgement));

  return metadataIsConsistent && attemptStatusIsConsistent(candidate);
}

export function isArchivePayload(value: unknown): value is ArchivePayload {
  return Boolean(
    isObject(value) &&
      value.version === 1 &&
      Array.isArray(value.attempts) &&
      value.attempts.every(isAttemptRecord),
  );
}
