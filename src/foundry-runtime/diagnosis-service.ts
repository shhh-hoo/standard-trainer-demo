import { evaluatePublishedAttempt } from "./adapters";
import { selectSupportHint } from "./support";
import type {
  DiagnosisCategory,
  DiagnosisFailureCode,
  NormalizedAttempt,
  PublishedComponentRegistry,
} from "./types";

export interface LearnerDiagnosisRequest {
  readonly runPurpose: "PRODUCT" | "AGENT_EVAL";
  readonly componentId: string;
  readonly componentVersion?: string;
  readonly problemContext: {
    readonly prompt: string;
    readonly reactionEquation: string;
    readonly givenValues: readonly { readonly label: string; readonly value: number; readonly unit: string }[];
    readonly targetQuantity: string;
    readonly answerRequirement?: string;
  };
  readonly problemContextEvidence: {
    readonly promptQuote: string;
    readonly reactionEquationQuote: string;
    readonly givenValueQuotes: readonly string[];
    readonly targetQuantityQuote: string;
    readonly answerRequirementQuote: string;
  };
  readonly attempt: unknown;
}

export interface LearnerDiagnosisResponse {
  readonly runPurpose: "PRODUCT" | "AGENT_EVAL";
  readonly componentId: string;
  readonly componentVersion: string;
  readonly diagnosis: {
    readonly decision: "SOLVED" | "STUDENT_ERROR" | "INCOMPLETE_EVIDENCE";
    readonly firstPedagogicalIssue: DiagnosisCategory | null;
    readonly failureCode: DiagnosisFailureCode | null;
    readonly evidence: readonly string[];
  };
  readonly recommendedSupport: string | null;
  readonly traceId: string;
}

export interface LearnerDiagnosisDependencies {
  readonly registry: PublishedComponentRegistry;
  readonly now?: () => string;
  readonly createId?: () => string;
}

function serviceError(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

function parseAttempt(value: unknown): NormalizedAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return serviceError("INVALID_DIAGNOSIS_REQUEST", "attempt must be an object.");
  }
  return value as NormalizedAttempt;
}

function validateProblemContext(value: LearnerDiagnosisRequest["problemContext"] | undefined): void {
  if (!value || !value.prompt?.trim() || !value.reactionEquation?.trim() || !value.targetQuantity?.trim() || !Array.isArray(value.givenValues) || value.givenValues.length === 0) {
    serviceError("INCOMPLETE_PROBLEM_CONTEXT", "Original prompt, reaction equation, given values and target quantity are required.");
  }
  if (value.givenValues.some((item) => !item.label?.trim() || !Number.isFinite(item.value) || !item.unit?.trim())) serviceError("INCOMPLETE_PROBLEM_CONTEXT", "Every given value requires a label, finite value and unit.");
}

function validateProblemContextEvidence(request: LearnerDiagnosisRequest): void {
  const evidence = request.problemContextEvidence;
  if (!evidence || !evidence.promptQuote?.trim() || !evidence.reactionEquationQuote?.trim() || !evidence.targetQuantityQuote?.trim() || !evidence.answerRequirementQuote?.trim() || !Array.isArray(evidence.givenValueQuotes) || evidence.givenValueQuotes.length !== request.problemContext.givenValues.length || evidence.givenValueQuotes.some((quote) => !quote.trim())) {
    serviceError("INCOMPLETE_PROBLEM_CONTEXT_EVIDENCE", "Problem context requires non-empty, one-to-one provenance quotes.");
  }
}

export async function runLearnerDiagnosis(
  request: LearnerDiagnosisRequest,
  dependencies: LearnerDiagnosisDependencies,
): Promise<LearnerDiagnosisResponse> {
  const component = dependencies.registry.get(request.componentId, request.componentVersion);
  if (!component) serviceError("COMPONENT_NOT_FOUND", `No published component matches ${request.componentId}${request.componentVersion ? `@${request.componentVersion}` : ""}.`);
  validateProblemContext(request.problemContext);
  validateProblemContextEvidence(request);
  const attempt = parseAttempt(request.attempt);
  const traceId = dependencies.createId?.() ?? `trainer-trace-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
  const result = evaluatePublishedAttempt(component, attempt, {
    traceId,
    submittedAt: dependencies.now?.() ?? new Date().toISOString(),
  });
  if (!result.ok) serviceError(result.kind, result.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
  const support = selectSupportHint(component, result.trace);
  return {
    runPurpose: request.runPurpose,
    componentId: component.id,
    componentVersion: component.version,
    diagnosis: {
      decision: result.trace.decision,
      firstPedagogicalIssue: result.trace.firstPedagogicalError,
      failureCode: result.trace.failureCode,
      evidence: result.trace.evidence,
    },
    recommendedSupport: support?.text ?? null,
    traceId: result.trace.traceId,
  };
}
