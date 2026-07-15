import { STANDARD_TRAINER_CAPABILITY } from "./capability";
import { validateAttempt } from "./validation";
import type { DiagnosticTargetAdapter, DiagnosisCategory, DiagnosisContext, DiagnosisEngineResult, DiagnosisFailureCode, NormalizedAttempt, PublishedDiagnosticLearningComponent, ValidationResult } from "./types";

function componentValidation(expected: "KP" | "MASS", component: PublishedDiagnosticLearningComponent): ValidationResult {
  return component.target.kind === expected ? { ok: true } : { ok: false, issues: [{ path: "$.target.kind", code: "ADAPTER_TARGET_MISMATCH", message: `${expected} adapter cannot execute ${component.target.kind}.` }] };
}

function trace(component: PublishedDiagnosticLearningComponent, attempt: NormalizedAttempt, context: DiagnosisContext, decision: "SOLVED" | "STUDENT_ERROR" | "INCOMPLETE_EVIDENCE", failureCode: DiagnosisFailureCode | null, firstPedagogicalError: DiagnosisCategory | null, evidence: readonly string[]): DiagnosisEngineResult {
  return { ok: true, trace: { traceId: context.traceId, attemptId: attempt.attemptId, componentId: component.id, componentVersion: component.version, componentContentHash: component.publication.contentHash, runtimeVersion: STANDARD_TRAINER_CAPABILITY.runtimeVersion, decision, failureCode, firstPedagogicalError, evidence, submittedAt: context.submittedAt } };
}

function commonEvaluate(component: PublishedDiagnosticLearningComponent, attempt: NormalizedAttempt, context: DiagnosisContext, specific?: () => { readonly code: DiagnosisFailureCode; readonly category: DiagnosisCategory; readonly evidence: string } | null): DiagnosisEngineResult {
  const attemptValidation = validateAttempt(component, attempt);
  if (!attemptValidation.ok) return { ok: false, kind: "INVALID_ATTEMPT", issues: attemptValidation.issues };
  const strategy = component.reasoningGraph.acceptedStrategies.find((item) => item.id === attempt.strategyId);
  if (!strategy) return trace(component, attempt, context, "STUDENT_ERROR", "WRONG_METHOD", "STRATEGY", ["Attempt strategy is not in the published accepted-strategy set."]);
  const missing = strategy.nodeRequirements.filter((item) => item.requirement === "REQUIRED" && !attempt.evidencedReasoningNodeIds.includes(item.nodeId));
  if (missing.length) return trace(component, attempt, context, "INCOMPLETE_EVIDENCE", "MISSING_REASONING_LINK", component.reasoningGraph.nodes[missing[0].nodeId]?.category ?? "STRATEGY", [`Missing required reasoning node ${missing[0].nodeId}.`]);
  for (const [factId, observed] of Object.entries(attempt.substitutedFacts)) {
    const authored = component.authoredFacts.find((fact) => fact.id === factId);
    if (!authored || typeof authored.value !== "number" || Math.abs(authored.value - observed) > component.target.absoluteTolerance) return trace(component, attempt, context, "STUDENT_ERROR", "WRONG_VALUE_SUBSTITUTED", "SUBSTITUTION", [`${factId} does not match the authored fact.`]);
  }
  const targetSpecific = specific?.();
  if (targetSpecific) return trace(component, attempt, context, "STUDENT_ERROR", targetSpecific.code, targetSpecific.category, [targetSpecific.evidence]);
  if (attempt.arithmeticWorkingValue !== undefined && Math.abs(attempt.arithmeticWorkingValue - component.target.expectedValue) > component.target.absoluteTolerance) return trace(component, attempt, context, "STUDENT_ERROR", "ARITHMETIC_ERROR", "ARITHMETIC", ["Declared working value does not match deterministic recomputation."]);
  if (Math.abs(attempt.finalAnswer.value - component.target.expectedValue) > component.target.absoluteTolerance) return trace(component, attempt, context, "STUDENT_ERROR", "WRONG_VALUE_SUBSTITUTED", "SUBSTITUTION", [`Expected ${component.target.expectedValue}; observed ${attempt.finalAnswer.value}.`]);
  if (!component.target.acceptedUnits.includes(attempt.finalAnswer.unit)) return trace(component, attempt, context, "STUDENT_ERROR", "UNIT_ERROR", "UNIT", [`${attempt.finalAnswer.unit || "No unit"} is not accepted.`]);
  if (attempt.finalAnswer.significantFigures !== component.target.significantFigures) return trace(component, attempt, context, "STUDENT_ERROR", "SIGNIFICANT_FIGURES_ERROR", "PRECISION", [`Expected ${component.target.significantFigures} significant figures.`]);
  return trace(component, attempt, context, "SOLVED", null, null, ["Structured evidence satisfies the published reasoning contract."]);
}

export const KpTargetAdapter: DiagnosticTargetAdapter = {
  targetKind: "KP",
  validateComponent: (component) => componentValidation("KP", component),
  evaluateAttempt: (component, attempt, context) => commonEvaluate(component, attempt, context),
};

export const MassStoichiometryTargetAdapter: DiagnosticTargetAdapter = {
  targetKind: "MASS",
  validateComponent: (component) => componentValidation("MASS", component),
  evaluateAttempt: (component, attempt, context) => commonEvaluate(component, attempt, context, () => attempt.stoichiometricRatio !== undefined && Math.abs(attempt.stoichiometricRatio - 1) > component.target.absoluteTolerance ? { code: "WRONG_STOICHIOMETRIC_RATIO", category: "FORMULA", evidence: "Learner ratio does not match the balanced 2:2 Mg:MgO contract." } : null),
};

const adapters: readonly DiagnosticTargetAdapter[] = [KpTargetAdapter, MassStoichiometryTargetAdapter];

export function getTargetAdapter(targetKind: string): DiagnosticTargetAdapter | null {
  return adapters.find((adapter) => adapter.targetKind === targetKind) ?? null;
}

export function evaluatePublishedAttempt(component: PublishedDiagnosticLearningComponent, attempt: NormalizedAttempt, context: DiagnosisContext): DiagnosisEngineResult {
  const adapter = getTargetAdapter(component.target.kind);
  if (!adapter) return { ok: false, kind: "UNSUPPORTED_TARGET", issues: [{ path: "$.target.kind", code: "UNSUPPORTED_TARGET_KIND", message: `No verified adapter exists for ${component.target.kind}.` }] };
  const validation = adapter.validateComponent(component);
  return validation.ok ? adapter.evaluateAttempt(component, attempt, context) : { ok: false, kind: "INVALID_COMPONENT", issues: validation.issues };
}
