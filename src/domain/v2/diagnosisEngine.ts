import { runDeterministicChecks } from "./deterministicChecks";
import { latestRevision, latestStepMatching, revisionForStep } from "./attemptOrder";
import { aggregateRecognitionGate } from "./recognitionGate";
import { alignReasoningEvidence } from "./reasoningAlignment";
import { validateSupportedDiagnosticProblem } from "./supportedProblem";
import {
  validateDiagnosticEvidenceTraceV2,
  validateDiagnosticProblemDefinitionV2,
  validateNormalizedAttempt,
  type ValidationIssue,
} from "./runtimeValidation";
import {
  V2_CONTRACT_VERSION,
  type AttemptSupportOutcome,
  type DiagnosticEvidenceTraceV2,
  type DiagnosticProblemDefinitionV2,
  type ExpectedStageEvaluation,
  type NormalizedAttempt,
} from "./types";

export interface DiagnosisContext {
  readonly traceId: string;
  readonly submittedAt: string;
  readonly interpreter: DiagnosticEvidenceTraceV2["interpreter"];
}

export type DiagnosisEngineResult =
  | { readonly ok: true; readonly trace: DiagnosticEvidenceTraceV2 }
  | {
      readonly ok: false;
      readonly kind: "INVALID_PROBLEM" | "INVALID_ATTEMPT" | "INTERNAL_INVARIANT_FAILURE";
      readonly issues: readonly ValidationIssue[];
    };

function supportOutcome(
  attempt: NormalizedAttempt,
  solved: boolean,
  recognitionPassed: boolean,
): AttemptSupportOutcome {
  if (!recognitionPassed) return "INSUFFICIENT_EVIDENCE";
  const resultStep = latestStepMatching(
    attempt,
    (step) =>
      step.calculation?.target.source === "REASONING_QUANTITY" &&
      step.calculation.target.reasoningNodeId === "calculate-result",
  );
  const causalRevision = resultStep
    ? revisionForStep(attempt, resultStep.id)
    : solved
      ? null
      : latestRevision(attempt);
  const causalEvents = causalRevision
    ? attempt.assistanceEvents.filter((event) =>
        causalRevision.precededByAssistanceEventIds.includes(event.id),
      )
    : [];
  const highestLevel = causalEvents.reduce((highest, event) => Math.max(highest, event.level), 0);
  if (!solved) {
    return highestLevel === 4 ? "NOT_SOLVED_AFTER_FULL_SCAFFOLD" : "INSUFFICIENT_EVIDENCE";
  }
  return highestLevel === 4
    ? "SOLVED_USING_FULL_SCAFFOLD"
    : highestLevel === 3
      ? "SOLVED_AFTER_FORMULA_HINT"
      : highestLevel === 2
        ? "SOLVED_AFTER_STRATEGY_HINT"
        : highestLevel === 1
          ? "SOLVED_AFTER_METACOGNITIVE_PROMPT"
          : "SOLVED_INDEPENDENTLY";
}

function gatedStages(
  gate: ReturnType<typeof aggregateRecognitionGate>,
): readonly ExpectedStageEvaluation[] {
  const order = [
    "DATA_EXTRACTION",
    "TARGET_IDENTIFICATION",
    "STRATEGY",
    "FORMULA",
    "SUBSTITUTION",
    "ARITHMETIC",
    "UNIT",
    "PRECISION",
  ] as const;
  return order.map((category) => ({
    category,
    status: gate.affectedCategories.includes(category)
      ? ("AMBIGUOUS_RECOGNITION" as const)
      : ("NOT_EVALUATED" as const),
    failureCode: null,
    evidenceStepIds: gate.affectedCategories.includes(category) ? gate.affectedStepIds : [],
  }));
}

export function diagnoseNormalizedAttempt(
  problem: DiagnosticProblemDefinitionV2,
  attempt: unknown,
  context: DiagnosisContext,
): DiagnosisEngineResult {
  const problemValidation = validateDiagnosticProblemDefinitionV2(problem);
  if (!problemValidation.ok) {
    return { ok: false, kind: "INVALID_PROBLEM", issues: problemValidation.issues };
  }
  const supportedProblem = validateSupportedDiagnosticProblem(problemValidation.value);
  if (!supportedProblem.ok) {
    return { ok: false, kind: "INVALID_PROBLEM", issues: supportedProblem.issues };
  }
  const attemptValidation = validateNormalizedAttempt(attempt, supportedProblem.value);
  if (!attemptValidation.ok) {
    return { ok: false, kind: "INVALID_ATTEMPT", issues: attemptValidation.issues };
  }

  try {
    const normalized = attemptValidation.value;
    const recognitionGate = aggregateRecognitionGate(supportedProblem.value, normalized);
    let alignmentEvidence: DiagnosticEvidenceTraceV2["alignmentEvidence"] = [];
    let deterministicChecks: DiagnosticEvidenceTraceV2["deterministicChecks"] = [];
    let stageEvaluations: DiagnosticEvidenceTraceV2["stageEvaluations"];
    let selectedStrategyId: string | null = null;

    if (recognitionGate.decision !== "PASSED") {
      stageEvaluations = gatedStages(recognitionGate);
    } else {
      const alignment = alignReasoningEvidence(supportedProblem.value, normalized);
      const checks = runDeterministicChecks(supportedProblem.value, normalized, alignment);
      alignmentEvidence = alignment.evidence;
      deterministicChecks = checks.deterministicChecks;
      stageEvaluations = checks.stageEvaluations;
      selectedStrategyId = checks.selectedStrategyId;
    }

    const firstIncorrect = stageEvaluations.find(({ status }) => status === "INCORRECT");
    const solved =
      recognitionGate.decision === "PASSED" &&
      !firstIncorrect &&
      selectedStrategyId !== null &&
      ["CORRECT", "SUPPORTED_BY_HINT"].includes(
        stageEvaluations.find(({ category }) => category === "FORMULA")?.status ?? "",
      ) &&
      ["CORRECT", "SUPPORTED_BY_HINT"].includes(
        stageEvaluations.find(({ category }) => category === "SUBSTITUTION")?.status ?? "",
      ) &&
      stageEvaluations.find(({ category }) => category === "ARITHMETIC")?.status === "CORRECT" &&
      stageEvaluations.find(({ category }) => category === "UNIT")?.status === "CORRECT" &&
      stageEvaluations.find(({ category }) => category === "PRECISION")?.status === "CORRECT";
    const attemptSupportOutcome = supportOutcome(
      normalized,
      solved,
      recognitionGate.decision === "PASSED",
    );
    const decision =
      recognitionGate.decision !== "PASSED"
        ? "RECOGNITION_UNCERTAIN"
        : solved
          ? "SOLVED"
          : attemptSupportOutcome === "NOT_SOLVED_AFTER_FULL_SCAFFOLD"
            ? "NOT_SOLVED"
          : firstIncorrect
            ? "STUDENT_ERROR"
            : "INCOMPLETE_EVIDENCE";

    const trace: DiagnosticEvidenceTraceV2 = {
      schemaVersion: V2_CONTRACT_VERSION,
      traceId: context.traceId,
      attemptId: normalized.attemptId,
      problemDefinitionId: problem.id,
      problemDefinitionVersion: problem.version,
      reasoningGraphVersion: problem.reasoningGraph.version,
      diagnosisPolicyVersion: problem.diagnosisPolicyVersion,
      recognitionPolicyVersion: problem.recognitionPolicy.version,
      hintPolicyVersion: problem.hintPolicy.version,
      interpreter: context.interpreter,
      recognitionGateDecision: recognitionGate.decision,
      recognitionIssues: normalized.recognitionIssues,
      alignmentEvidence,
      deterministicChecks,
      stageEvaluations,
      decision,
      failureCode: firstIncorrect?.failureCode ?? null,
      firstPedagogicalError: firstIncorrect?.category ?? null,
      assistanceEvents: normalized.assistanceEvents,
      revisions: normalized.revisions,
      attemptSupportOutcome,
      submittedAt: context.submittedAt,
    };
    const traceValidation = validateDiagnosticEvidenceTraceV2(trace, supportedProblem.value);
    return traceValidation.ok
      ? { ok: true, trace: traceValidation.value }
      : {
          ok: false,
          kind: "INTERNAL_INVARIANT_FAILURE",
          issues: traceValidation.issues,
        };
  } catch (error) {
    return {
      ok: false,
      kind: "INTERNAL_INVARIANT_FAILURE",
      issues: [
        {
          path: "$",
          code: "UNEXPECTED_ENGINE_FAILURE",
          message: error instanceof Error ? error.message : "Unexpected diagnosis failure.",
        },
      ],
    };
  }
}
