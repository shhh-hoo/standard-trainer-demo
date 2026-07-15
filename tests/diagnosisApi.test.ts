import { describe, expect, it } from "vitest";
import {
  StaticBundledRegistryProvider,
  createDiagnosisApiHandler,
  loadMergedRegistry,
} from "../src/foundry-runtime";

describe("Trainer Diagnosis HTTP contract", () => {
  it("reports health without exposing secrets", async () => {
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    const handle = createDiagnosisApiHandler({ registry });
    const response = await handle(new Request("http://127.0.0.1:4177/health"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: "trainer-diagnosis-api" });
  });

  it("returns structured client errors for malformed requests", async () => {
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    const handle = createDiagnosisApiHandler({ registry });
    const response = await handle(new Request("http://127.0.0.1:4177/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "INVALID_DIAGNOSIS_REQUEST" } });
  });
});
