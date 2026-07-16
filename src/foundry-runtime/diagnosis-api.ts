import { runLearnerDiagnosis, type LearnerDiagnosisDependencies, type LearnerDiagnosisRequest } from "./diagnosis-service";
import { STANDARD_TRAINER_CAPABILITY } from "./capability";

export interface LearnerDiagnosisTraceStore {
  save(record: {
    readonly traceId: string;
    readonly runPurpose: "PRODUCT" | "AGENT_EVAL";
    readonly request: LearnerDiagnosisRequest;
    readonly component: { readonly id: string; readonly version: string; readonly contentHash: string };
    readonly runtimeVersion: string;
    readonly diagnosis: unknown;
    readonly recommendedSupport: string | null;
    readonly timestamp: string;
  }): Promise<void>;
  get(traceId: string): Promise<unknown | null>;
  list(runPurpose?: "PRODUCT" | "AGENT_EVAL"): Promise<readonly unknown[]>;
  clear?(runPurpose: "PRODUCT" | "AGENT_EVAL"): Promise<void>;
}

export interface GovernedCalculationCaseStore {
  get(caseId: string): Promise<unknown | null>;
  list(): Promise<readonly unknown[]>;
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

export function createDiagnosisApiHandler(dependencies: LearnerDiagnosisDependencies, repository?: LearnerDiagnosisTraceStore, caseRepository?: GovernedCalculationCaseStore) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json(204, null);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, service: "trainer-diagnosis-api", governedCaseCount: caseRepository ? (await caseRepository.list()).length : 0 });
    }
    if (request.method === "GET" && url.pathname.startsWith("/cases/")) {
      const caseId = decodeURIComponent(url.pathname.slice("/cases/".length));
      const calculationCase = caseRepository ? await caseRepository.get(caseId) : null;
      return calculationCase ? json(200, { ok: true, case: calculationCase, evidenceClassification: "GOVERNED_CASE_NOT_LIVE_STUDENT_EVIDENCE" }) : json(404, { ok: false, error: { code: "CALCULATION_CASE_NOT_FOUND", message: "No governed calculation case has this id." } });
    }
    if (request.method === "GET" && url.pathname === "/cases") {
      return json(200, { ok: true, cases: caseRepository ? await caseRepository.list() : [], evidenceClassification: "GOVERNED_CASE_NOT_LIVE_STUDENT_EVIDENCE" });
    }
    if (request.method === "GET" && url.pathname.startsWith("/diagnoses/")) {
      const traceId = decodeURIComponent(url.pathname.slice("/diagnoses/".length));
      const diagnosis = repository ? await repository.get(traceId) : null;
      return diagnosis ? json(200, { ok: true, diagnosis }) : json(404, { ok: false, error: { code: "DIAGNOSIS_TRACE_NOT_FOUND", message: "No persisted Learner Diagnosis has this trace id." } });
    }
    if (request.method === "GET" && url.pathname === "/diagnoses") {
      const purpose = url.searchParams.get("runPurpose");
      const runPurpose = purpose === "PRODUCT" || purpose === "AGENT_EVAL" ? purpose : undefined;
      return json(200, { ok: true, diagnoses: repository ? await repository.list(runPurpose) : [] });
    }
    if (request.method === "DELETE" && url.pathname === "/diagnoses") {
      const purpose = url.searchParams.get("runPurpose");
      if (purpose !== "PRODUCT" && purpose !== "AGENT_EVAL") return json(400, { ok: false, error: { code: "RUN_PURPOSE_REQUIRED", message: "Choose PRODUCT or AGENT_EVAL diagnoses to clear." } });
      await repository?.clear?.(purpose);
      return json(200, { ok: true, cleared: "diagnoses", runPurpose: purpose });
    }
    if (request.method === "POST" && url.pathname === "/diagnose") {
      try {
        const body = await request.json() as Partial<LearnerDiagnosisRequest>;
        if ((body.runPurpose !== "PRODUCT" && body.runPurpose !== "AGENT_EVAL") || typeof body.componentId !== "string" || !body.componentId || !("problemContext" in body) || !("problemContextEvidence" in body) || !("attempt" in body)) {
          throw new Error("INVALID_DIAGNOSIS_REQUEST: runPurpose, componentId, problemContext, problemContextEvidence and attempt are required.");
        }
        const diagnosisRequest = body as LearnerDiagnosisRequest;
        const result = await runLearnerDiagnosis(diagnosisRequest, dependencies);
        const component = dependencies.registry.get(result.componentId, result.componentVersion);
        if (!component) throw new Error("COMPONENT_NOT_FOUND: Diagnosed component is no longer resolvable.");
        await repository?.save({
          traceId: result.traceId,
          runPurpose: diagnosisRequest.runPurpose,
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
