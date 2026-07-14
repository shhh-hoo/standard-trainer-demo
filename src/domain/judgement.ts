import type {
  ActiveStandard,
  AuthorityScope,
  CurriculumContext,
  FailureCode,
  JudgementResult,
  ReviewerStatus,
  SourceStatus,
} from "./types";

export interface JudgeAnswerInput {
  readonly activeStandard: ActiveStandard | null;
  readonly answer: string;
  readonly curriculum: CurriculumContext;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[‘’‚‛`´]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ")
    .replace(/['"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function derivesAuthorityScope(sourceStatus: SourceStatus): AuthorityScope {
  if (sourceStatus === "EXPERT_REVIEWED") {
    return "EXPERT_REVIEWED";
  }

  if (sourceStatus === "SOURCE_BACKED") {
    return "SOURCE_BACKED";
  }

  return "DRAFT_RUBRIC_ONLY";
}

function matchesAny(normalizedAnswer: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => new RegExp(pattern, "i").test(normalizedAnswer));
}

function unavailableResult(
  failureCode: Extract<FailureCode, "STANDARD_NOT_FOUND">,
): JudgementResult {
  return {
    decision: "UNAVAILABLE",
    failureCode,
    authorityScope: "DRAFT_RUBRIC_ONLY",
    sourceStatus: "FLAGGED",
    reviewerStatus: "flagged",
    satisfiedElementIds: [],
    missingElementIds: [],
    dangerousClaimIds: [],
    boundaryErrors: [],
    feedbackItems: [
      {
        elementId: null,
        reason: "No matching Standard Node is available for this request.",
        sourceIds: [],
      },
    ],
    reviewReasons: [failureCode],
    scoringPerformed: false,
    standardNodeVersion: "unavailable",
    rubricVersion: "unavailable",
    deterministicRuleVersion: "unavailable",
    sourceIds: [],
  };
}

function policyResult(
  activeStandard: ActiveStandard,
  decision: "REVIEW" | "UNAVAILABLE",
  failureCode: Exclude<FailureCode, null | "STANDARD_NOT_FOUND">,
  reason: string,
): JudgementResult {
  const { node, evidence } = activeStandard;
  return {
    decision,
    failureCode,
    authorityScope: derivesAuthorityScope(node.sourceStatus),
    sourceStatus: node.sourceStatus,
    reviewerStatus: node.reviewerStatus,
    satisfiedElementIds: [],
    missingElementIds: [],
    dangerousClaimIds: [],
    boundaryErrors: [],
    feedbackItems: [{ elementId: null, reason, sourceIds: evidence.sourceIds }],
    reviewReasons: [failureCode],
    scoringPerformed: false,
    standardNodeVersion: node.version,
    rubricVersion: node.rubricVersion,
    deterministicRuleVersion: node.deterministicRuleVersion,
    sourceIds: evidence.sourceIds,
  };
}

function resultBase(activeStandard: ActiveStandard): {
  authorityScope: AuthorityScope;
  sourceStatus: SourceStatus;
  reviewerStatus: ReviewerStatus;
  standardNodeVersion: string;
  rubricVersion: string;
  deterministicRuleVersion: string;
  sourceIds: readonly string[];
} {
  const { node, evidence } = activeStandard;
  return {
    authorityScope: derivesAuthorityScope(node.sourceStatus),
    sourceStatus: node.sourceStatus,
    reviewerStatus: node.reviewerStatus,
    standardNodeVersion: node.version,
    rubricVersion: node.rubricVersion,
    deterministicRuleVersion: node.deterministicRuleVersion,
    sourceIds: evidence.sourceIds,
  };
}

export function judgeAnswer({ activeStandard, answer, curriculum }: JudgeAnswerInput): JudgementResult {
  if (!activeStandard) {
    return unavailableResult("STANDARD_NOT_FOUND");
  }

  const { node, evidence, legacyReferences } = activeStandard;

  if (curriculum.board !== node.board || curriculum.syllabusCode !== node.syllabusCode) {
    return policyResult(
      activeStandard,
      "UNAVAILABLE",
      "WRONG_CURRICULUM",
      "The active Standard Node does not match the requested exam board or syllabus code.",
    );
  }

  if (curriculum.syllabusCycle !== node.syllabusCycle) {
    return policyResult(
      activeStandard,
      "UNAVAILABLE",
      "STALE_STANDARD",
      "The active Standard Node does not match the requested syllabus cycle.",
    );
  }

  if (evidence.hasValidSourceConflict) {
    return policyResult(
      activeStandard,
      "REVIEW",
      "SOURCE_CONFLICT",
      "Valid sources conflict, so this answer requires review before rubric scoring.",
    );
  }

  const normalizedAnswer = normalizeText(answer);
  const legacyConflict = legacyReferences.find(
    (legacyItem) =>
      node.legacyContentIds.includes(legacyItem.id) &&
      normalizedAnswer === normalizeText(legacyItem.answer),
  );

  if (legacyConflict) {
    return policyResult(
      activeStandard,
      "REVIEW",
      "LEGACY_REFERENCE_CONFLICT",
      "The current draft rubric requests an explicit statement that both reactions continue. The frozen legacy canonical answer does not state this separately, so curriculum review is required before production use.",
    );
  }

  const satisfiedElementIds: string[] = [];
  const missingElementIds: string[] = [];

  for (const element of node.requiredElements) {
    if (matchesAny(normalizedAnswer, element.acceptedPatterns)) {
      satisfiedElementIds.push(element.id);
    } else if (element.required) {
      missingElementIds.push(element.id);
    }
  }

  const dangerousClaims = node.dangerousClaims.filter((claim) =>
    matchesAny(normalizedAnswer, claim.patterns),
  );
  const dangerousClaimIds = dangerousClaims.map((claim) => claim.id);
  const boundaryErrors = dangerousClaims.map((claim) => claim.boundaryError);
  const base = resultBase(activeStandard);

  if (dangerousClaims.length > 0) {
    return {
      decision: "REWRITE",
      failureCode: "DANGEROUS_CLAIM",
      ...base,
      satisfiedElementIds,
      missingElementIds,
      dangerousClaimIds,
      boundaryErrors,
      feedbackItems: [
        ...dangerousClaims.map((claim) => ({
          elementId: null,
          reason: claim.reason,
          sourceIds: claim.sourceIds,
        })),
        ...node.requiredElements
          .filter((element) => missingElementIds.includes(element.id))
          .map((element) => ({
            elementId: element.id,
            reason: element.description,
            sourceIds: element.sourceIds,
          })),
      ],
      reviewReasons: [],
      scoringPerformed: true,
    };
  }

  if (missingElementIds.length > 0) {
    return {
      decision: "REWRITE",
      failureCode: "MISSING_REQUIRED_ELEMENT",
      ...base,
      satisfiedElementIds,
      missingElementIds,
      dangerousClaimIds: [],
      boundaryErrors: [],
      feedbackItems: node.requiredElements
        .filter((element) => missingElementIds.includes(element.id))
        .map((element) => ({
          elementId: element.id,
          reason: element.description,
          sourceIds: element.sourceIds,
        })),
      reviewReasons: [],
      scoringPerformed: true,
    };
  }

  return {
    decision: "PASS",
    failureCode: null,
    ...base,
    satisfiedElementIds,
    missingElementIds: [],
    dangerousClaimIds: [],
    boundaryErrors: [],
    feedbackItems: [],
    reviewReasons: [],
    scoringPerformed: true,
  };
}
