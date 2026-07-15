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

  it("persists a completed diagnosis and resolves it independently by trace id", async () => {
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    const records = new Map<string, unknown>();
    const repository = {
      save: async (record: { readonly traceId: string }) => { records.set(record.traceId, record); },
      get: async (traceId: string) => records.get(traceId) ?? null,
      list: async () => [...records.values()],
    };
    const handle = createDiagnosisApiHandler({ registry, createId: () => "diagnosis-api-trace", now: () => "2026-07-16T00:00:00.000Z" }, repository);
    const component = registry.get("stoichiometric-product-mass");
    expect(component).not.toBeNull();
    const response = await handle(new Request("http://127.0.0.1:4177/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        componentId: component!.id,
        problemContext: {
          prompt: component!.presentation.prompt,
          reactionEquation: component!.presentation.reaction,
          givenValues: component!.authoredFacts.filter((fact) => typeof fact.value === "number").map((fact) => ({ label: fact.label, value: fact.value, unit: fact.unit ?? "unitless" })),
          targetQuantity: component!.presentation.title,
          answerRequirement: `${component!.target.significantFigures} significant figures`,
        },
        attempt: {
          attemptId: "api-attempt", componentId: component!.id, componentVersion: component!.version,
          strategyId: component!.reasoningGraph.acceptedStrategies[0]!.id,
          evidencedReasoningNodeIds: [], substitutedFacts: {},
          finalAnswer: { value: 0, unit: component!.target.acceptedUnits[0], significantFigures: component!.target.significantFigures },
        },
      }),
    }));
    expect(response.status).toBe(200);
    const storedResponse = await handle(new Request("http://127.0.0.1:4177/diagnoses/diagnosis-api-trace"));
    expect(storedResponse.status).toBe(200);
    expect(await storedResponse.json()).toMatchObject({ ok: true, diagnosis: { traceId: "diagnosis-api-trace", component: { id: component!.id, contentHash: component!.publication.contentHash } } });
  });
});
