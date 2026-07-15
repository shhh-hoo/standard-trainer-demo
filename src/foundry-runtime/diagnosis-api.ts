import { runLearnerDiagnosis, type LearnerDiagnosisDependencies, type LearnerDiagnosisRequest } from "./diagnosis-service";
import { STANDARD_TRAINER_CAPABILITY } from "./capability";

export interface LearnerDiagnosisTraceStore {
  save(record: {
    readonly traceId: string;
    readonly request: LearnerDiagnosisRequest;
    readonly component: { readonly id: string; readonly version: string; readonly contentHash: string };
    readonly runtimeVersion: string;
    readonly diagnosis: unknown;
    readonly recommendedSupport: string | null;
    readonly timestamp: string;
  }): Promise<void>;
  get(traceId: string): Promise<unknown | null>;
  list(): Promise<readonly unknown[]>;
  clear?(): Promise<void>;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    },
  });
}

function codeFrom(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /^[A-Z][A-Z_]+:/.test(message) ? message.slice(0, message.indexOf(":")) : "DIAGNOSIS_API_ERROR";
}

export function createDiagnosisApiHandler(dependencies: LearnerDiagnosisDependencies, repository?: LearnerDiagnosisTraceStore) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json(204, null);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, service: "trainer-diagnosis-api" });
    }
    if (request.method === "GET" && url.pathname.startsWith("/diagnoses/")) {
      const traceId = decodeURIComponent(url.pathname.slice("/diagnoses/".length));
      const diagnosis = repository ? await repository.get(traceId) : null;
      return diagnosis ? json(200, { ok: true, diagnosis }) : json(404, { ok: false, error: { code: "DIAGNOSIS_TRACE_NOT_FOUND", message: "No persisted Learner Diagnosis has this trace id." } });
    }
    if (request.method === "GET" && url.pathname === "/diagnoses") {
      return json(200, { ok: true, diagnoses: repository ? await repository.list() : [] });
    }
    if (request.method === "DELETE" && url.pathname === "/diagnoses") {
      await repository?.clear?.();
      return json(200, { ok: true, cleared: "diagnoses" });
    }
    if (request.method === "POST" && url.pathname === "/diagnose") {
      try {
        const body = await request.json() as Partial<LearnerDiagnosisRequest>;
        if (typeof body.componentId !== "string" || !body.componentId || !("problemContext" in body) || !("attempt" in body)) {
          throw new Error("INVALID_DIAGNOSIS_REQUEST: componentId, problemContext and attempt are required.");
        }
        const diagnosisRequest = body as LearnerDiagnosisRequest;
        const result = await runLearnerDiagnosis(diagnosisRequest, dependencies);
        const component = dependencies.registry.get(result.componentId, result.componentVersion);
        if (!component) throw new Error("COMPONENT_NOT_FOUND: Diagnosed component is no longer resolvable.");
        await repository?.save({
          traceId: result.traceId,
          request: diagnosisRequest,
          component: { id: component.id, version: component.version, contentHash: component.publication.contentHash },
          runtimeVersion: STANDARD_TRAINER_CAPABILITY.runtimeVersion,
          diagnosis: result.diagnosis,
          recommendedSupport: result.recommendedSupport,
          timestamp: dependencies.now?.() ?? new Date().toISOString(),
        });
        return json(200, { ok: true, result });
      } catch (error) {
        const code = codeFrom(error);
        const status = code === "COMPONENT_NOT_FOUND" ? 404 : 400;
        return json(status, { ok: false, error: { code, message: error instanceof Error ? error.message : String(error) } });
      }
    }
    return json(404, { ok: false, error: { code: "NOT_FOUND", message: "Route not found." } });
  };
}
