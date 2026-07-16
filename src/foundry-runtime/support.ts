import type { LearnerEvidenceTrace, PublishedDiagnosticLearningComponent } from "./types";

export type SelectedSupportHint = PublishedDiagnosticLearningComponent["hintPolicy"]["hints"][number];

export function selectSupportHint(
  component: PublishedDiagnosticLearningComponent,
  diagnosisTrace: LearnerEvidenceTrace,
): SelectedSupportHint | null {
  if (!diagnosisTrace.firstPedagogicalError) return null;
  return component.hintPolicy.hints
    .filter((hint) => hint.stage === diagnosisTrace.firstPedagogicalError)
    .sort((left, right) => left.level - right.level)[0] ?? null;
}
