import { judgeAnswer } from "./judgement";
import { buildLegacyCanonicalContentId } from "./legacyIdentity";
import type {
  ActiveStandard,
  AttemptRecord,
  CurriculumContext,
  LegacyMemorisationItem,
  PersistenceStatus,
} from "./types";

export type WorkflowPhase = "ANSWERING" | "REWRITING" | "COMPLETE" | "HELD";

export interface WorkflowState {
  readonly phase: WorkflowPhase;
  readonly attempt: AttemptRecord | null;
}

export interface WorkflowDependencies {
  readonly activeStandard: ActiveStandard | null;
  readonly legacyItem: LegacyMemorisationItem;
  readonly curriculum: CurriculumContext;
  readonly now: () => string;
  readonly createId: (kind: "attempt" | "trace") => string;
}

export function createWorkflowState(): WorkflowState {
  return { phase: "ANSWERING", attempt: null };
}

function phaseForDecision(decision: AttemptRecord["firstJudgement"]["decision"]): WorkflowPhase {
  if (decision === "REWRITE") {
    return "REWRITING";
  }

  if (decision === "REVIEW" || decision === "UNAVAILABLE") {
    return "HELD";
  }

  return "COMPLETE";
}

function statusForDecision(
  decision: AttemptRecord["firstJudgement"]["decision"],
): AttemptRecord["status"] {
  if (decision === "REWRITE") {
    return "AWAITING_REWRITE";
  }

  if (decision === "REVIEW" || decision === "UNAVAILABLE") {
    return "HELD";
  }

  return "COMPLETE";
}

export function submitFirstAnswer(
  state: WorkflowState,
  answer: string,
  dependencies: WorkflowDependencies,
): WorkflowState {
  if (state.phase !== "ANSWERING" || state.attempt) {
    throw new Error("A first answer can only be submitted from the answering phase.");
  }

  if (!answer.trim()) {
    throw new Error("Enter an answer before requesting feedback.");
  }

  const firstJudgement = judgeAnswer({
    activeStandard: dependencies.activeStandard,
    answer,
    curriculum: dependencies.curriculum,
  });
  const createdAt = dependencies.now();
  const attemptId = dependencies.createId("attempt");
  const traceId = dependencies.createId("trace");
  const node = dependencies.activeStandard?.node;
  const legacyCanonicalContentId = buildLegacyCanonicalContentId(
    dependencies.legacyItem.runtimeContext,
  );

  const attempt: AttemptRecord = {
    attemptId,
    legacyItemId: dependencies.legacyItem.id,
    legacyCanonicalContentId,
    standardNodeId: node?.id ?? "unavailable",
    standardNodeVersion: firstJudgement.standardNodeVersion,
    rubricVersion: firstJudgement.rubricVersion,
    deterministicRuleVersion: firstJudgement.deterministicRuleVersion,
    sourceIds: firstJudgement.sourceIds,
    sourceStatus: firstJudgement.sourceStatus,
    reviewerStatus: firstJudgement.reviewerStatus,
    authorityScope: firstJudgement.authorityScope,
    firstResponse: answer.trim(),
    firstJudgement,
    rewrite: null,
    secondJudgement: null,
    referenceRevealedAt: null,
    status: statusForDecision(firstJudgement.decision),
    persistenceStatus: "MEMORY_ONLY",
    trace: {
      traceId,
      attemptId,
      standardNodeId: node?.id ?? "unavailable",
      standardNodeVersion: firstJudgement.standardNodeVersion,
      rubricVersion: firstJudgement.rubricVersion,
      deterministicRuleVersion: firstJudgement.deterministicRuleVersion,
      sourceIds: firstJudgement.sourceIds,
      sourceStatus: firstJudgement.sourceStatus,
      reviewerStatus: firstJudgement.reviewerStatus,
      authorityScope: firstJudgement.authorityScope,
      persistenceStatus: "MEMORY_ONLY",
      firstJudgement,
      secondJudgement: null,
      createdAt,
      updatedAt: createdAt,
    },
    createdAt,
    updatedAt: createdAt,
  };

  return { phase: phaseForDecision(firstJudgement.decision), attempt };
}

export function submitRewrite(
  state: WorkflowState,
  rewrite: string,
  dependencies: WorkflowDependencies,
): WorkflowState {
  if (
    state.phase !== "REWRITING" ||
    !state.attempt ||
    state.attempt.firstJudgement.decision !== "REWRITE"
  ) {
    throw new Error("A rewrite is only available after a REWRITE decision.");
  }

  if (!rewrite.trim()) {
    throw new Error("Enter a rewrite before requesting the second judgement.");
  }

  const secondJudgement = judgeAnswer({
    activeStandard: dependencies.activeStandard,
    answer: rewrite,
    curriculum: dependencies.curriculum,
  });
  const updatedAt = dependencies.now();
  const held = secondJudgement.decision === "REVIEW" || secondJudgement.decision === "UNAVAILABLE";
  const attempt: AttemptRecord = {
    ...state.attempt,
    rewrite: rewrite.trim(),
    secondJudgement,
    status: held ? "HELD" : "COMPLETE",
    updatedAt,
    trace: {
      ...state.attempt.trace,
      secondJudgement,
      updatedAt,
    },
  };

  return { phase: held ? "HELD" : "COMPLETE", attempt };
}

export function revealReference(state: WorkflowState, now: () => string): WorkflowState {
  if (!state.attempt) {
    throw new Error("The reference can only be revealed after the first answer.");
  }

  if (state.attempt.referenceRevealedAt) {
    return state;
  }

  const revealedAt = now();
  return {
    ...state,
    attempt: {
      ...state.attempt,
      referenceRevealedAt: revealedAt,
      updatedAt: revealedAt,
      trace: { ...state.attempt.trace, updatedAt: revealedAt },
    },
  };
}

export function withPersistenceStatus(
  state: WorkflowState,
  persistenceStatus: PersistenceStatus,
): WorkflowState {
  if (!state.attempt) {
    return state;
  }

  return {
    ...state,
    attempt: {
      ...state.attempt,
      persistenceStatus,
      trace: { ...state.attempt.trace, persistenceStatus },
    },
  };
}
