import { runLearnerDiagnosis, type LearnerDiagnosisDependencies, type LearnerDiagnosisRequest } from "./diagnosis-service";

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

function codeFrom(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /^[A-Z][A-Z_]+:/.test(message) ? message.slice(0, message.indexOf(":")) : "DIAGNOSIS_API_ERROR";
}

export function createDiagnosisApiHandler(dependencies: LearnerDiagnosisDependencies) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json(204, null);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, service: "trainer-diagnosis-api" });
    }
    if (request.method === "POST" && url.pathname === "/diagnose") {
      try {
        const body = await request.json() as Partial<LearnerDiagnosisRequest>;
        if (typeof body.componentId !== "string" || !body.componentId || !("attempt" in body)) {
          throw new Error("INVALID_DIAGNOSIS_REQUEST: componentId and attempt are required.");
        }
        return json(200, { ok: true, result: await runLearnerDiagnosis(body as LearnerDiagnosisRequest, dependencies) });
      } catch (error) {
        const code = codeFrom(error);
        const status = code === "COMPONENT_NOT_FOUND" ? 404 : 400;
        return json(status, { ok: false, error: { code, message: error instanceof Error ? error.message : String(error) } });
      }
    }
    return json(404, { ok: false, error: { code: "NOT_FOUND", message: "Route not found." } });
  };
}
