import type { AttemptRevision, NormalizedAttempt, NormalizedStep } from "./types";

export function orderedRevisions(attempt: NormalizedAttempt): readonly AttemptRevision[] {
  return [...attempt.revisions].sort((left, right) => left.sequence - right.sequence);
}

export function orderedSteps(attempt: NormalizedAttempt): readonly NormalizedStep[] {
  const stepById = new Map(attempt.steps.map((step) => [step.id, step]));
  return orderedRevisions(attempt).flatMap((revision) =>
    revision.stepIds.flatMap((stepId) => {
      const step = stepById.get(stepId);
      return step ? [step] : [];
    }),
  );
}

export function latestStepMatching(
  attempt: NormalizedAttempt,
  predicate: (step: NormalizedStep) => boolean,
): NormalizedStep | null {
  return [...orderedSteps(attempt)].reverse().find(predicate) ?? null;
}

export function latestRevision(attempt: NormalizedAttempt): AttemptRevision | null {
  return orderedRevisions(attempt).at(-1) ?? null;
}

export function revisionForStep(
  attempt: NormalizedAttempt,
  stepId: string,
): AttemptRevision | null {
  return orderedRevisions(attempt).find((revision) => revision.stepIds.includes(stepId)) ?? null;
}

export function resolveDecisionRevision(
  attempt: NormalizedAttempt,
  solved: boolean,
): AttemptRevision | null {
  if (!solved) return latestRevision(attempt);
  const resultStep = latestStepMatching(
    attempt,
    (step) =>
      step.calculation?.target.source === "REASONING_QUANTITY" &&
      step.calculation.target.reasoningNodeId === "calculate-result",
  );
  return resultStep ? revisionForStep(attempt, resultStep.id) : null;
}
