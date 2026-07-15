import type {
  DiagnosisCategory,
  DiagnosticProblemDefinitionV2,
  NormalizedAttempt,
  NormalizedStep,
  RecognitionGateDecision,
  RecognitionIssue,
} from "./types";

export interface RecognitionGateResult {
  readonly decision: RecognitionGateDecision;
  readonly affectedStepIds: readonly string[];
  readonly affectedCategories: readonly DiagnosisCategory[];
  readonly issueIds: readonly string[];
}

function sourceMatches(step: NormalizedStep, issue: RecognitionIssue): boolean {
  if (issue.scope !== "REGION") return false;
  const left = step.source;
  const right = issue.source;
  if (
    left.artifactId !== right.artifactId ||
    left.modality !== right.modality ||
    !("page" in left) ||
    left.page !== right.page
  ) {
    return false;
  }
  return JSON.stringify(left.boundingBox) === JSON.stringify(right.boundingBox);
}

function categoriesForStep(step: NormalizedStep): readonly DiagnosisCategory[] {
  if (step.concept === "PARTIAL_PRESSURE") return ["STRATEGY", "SUBSTITUTION"];
  const category: DiagnosisCategory =
    step.semanticType === "DATA_SELECTION"
      ? "DATA_EXTRACTION"
      : step.semanticType === "TARGET_IDENTIFICATION"
        ? "TARGET_IDENTIFICATION"
        : step.semanticType === "STRATEGY"
          ? "STRATEGY"
          : step.semanticType === "FORMULA"
            ? "FORMULA"
            : step.semanticType === "SUBSTITUTION"
              ? "SUBSTITUTION"
              : step.semanticType === "ARITHMETIC"
                ? "ARITHMETIC"
                : step.semanticType === "UNIT"
                  ? "UNIT"
                  : step.semanticType === "FINAL_ANSWER"
                    ? "ARITHMETIC"
                    : "STRATEGY";
  return [category];
}

export function aggregateRecognitionGate(
  _problem: DiagnosticProblemDefinitionV2,
  attempt: NormalizedAttempt,
): RecognitionGateResult {
  const abstained = attempt.steps.some(({ recognition }) => recognition.status === "ABSTAINED") ||
    attempt.recognitionIssues.some(
      (issue) => issue.scope !== "STEP" && issue.recognition.status === "ABSTAINED",
    );
  const requiresConfirmation = attempt.steps.some(
    ({ recognition }) => recognition.status === "REQUIRES_CONFIRMATION",
  ) ||
    attempt.recognitionIssues.some(
      (issue) => issue.scope !== "STEP" && issue.recognition.status === "REQUIRES_CONFIRMATION",
    );

  const affected = new Set<string>();
  for (const issue of attempt.recognitionIssues) {
    if (issue.scope === "STEP") {
      affected.add(issue.stepId);
    } else if (issue.scope === "ARTIFACT") {
      attempt.steps
        .filter((step) => step.source.artifactId === issue.artifactId)
        .forEach((step) => affected.add(step.id));
    } else {
      attempt.steps.filter((step) => sourceMatches(step, issue)).forEach((step) => affected.add(step.id));
    }
  }
  for (const step of attempt.steps) {
    if (
      step.recognition.status === "ABSTAINED" ||
      step.recognition.status === "REQUIRES_CONFIRMATION"
    ) {
      affected.add(step.id);
    }
  }

  const affectedSteps = attempt.steps.filter((step) => affected.has(step.id));
  const categorySet = new Set(affectedSteps.flatMap(categoriesForStep));
  const order: readonly DiagnosisCategory[] = [
    "DATA_EXTRACTION",
    "TARGET_IDENTIFICATION",
    "STRATEGY",
    "FORMULA",
    "SUBSTITUTION",
    "ARITHMETIC",
    "UNIT",
    "PRECISION",
  ];

  return {
    decision: abstained ? "ABSTAINED" : requiresConfirmation ? "REQUIRES_CONFIRMATION" : "PASSED",
    affectedStepIds: affectedSteps.map(({ id }) => id),
    affectedCategories: order.filter((category) => categorySet.has(category)),
    issueIds: attempt.recognitionIssues.map(({ id }) => id),
  };
}
