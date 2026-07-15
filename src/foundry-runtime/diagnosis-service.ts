import { evaluatePublishedAttempt } from "./adapters";
import { selectSupportHint } from "./support";
import type {
  DiagnosisCategory,
  DiagnosisFailureCode,
  NormalizedAttempt,
  PublishedComponentRegistry,
} from "./types";

export interface LearnerDiagnosisRequest {
  readonly componentId: string;
  readonly componentVersion?: string;
  readonly attempt: unknown;
}

export interface LearnerDiagnosisResponse {
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

export async function runLearnerDiagnosis(
  request: LearnerDiagnosisRequest,
  dependencies: LearnerDiagnosisDependencies,
): Promise<LearnerDiagnosisResponse> {
  const component = dependencies.registry.get(request.componentId, request.componentVersion);
  if (!component) serviceError("COMPONENT_NOT_FOUND", `No published component matches ${request.componentId}${request.componentVersion ? `@${request.componentVersion}` : ""}.`);
  const attempt = parseAttempt(request.attempt);
  const traceId = dependencies.createId?.() ?? `trainer-trace-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
  const result = evaluatePublishedAttempt(component, attempt, {
    traceId,
    submittedAt: dependencies.now?.() ?? new Date().toISOString(),
  });
  if (!result.ok) serviceError(result.kind, result.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
  const support = selectSupportHint(component, result.trace);
  return {
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
