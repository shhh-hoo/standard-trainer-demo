import { describe, expect, it } from "vitest";
import massSnapshot from "../src/published-components/stoichiometric-product-mass.json";
import { computeContentHash } from "../src/foundry-runtime/contentHash";
import {
  LocalDemoRegistryProvider,
  StaticBundledRegistryProvider,
  loadMergedRegistry,
} from "../src/foundry-runtime/providers";
import type { PublishedDiagnosticLearningComponent } from "../src/foundry-runtime/types";
import { selectSupportHint } from "../src/foundry-runtime/support";

function dynamicV110(): PublishedDiagnosticLearningComponent {
  const original = structuredClone((massSnapshot as { readonly component: PublishedDiagnosticLearningComponent }).component);
  const component: PublishedDiagnosticLearningComponent = {
    ...original,
    version: "1.1.0",
    hintPolicy: { ...original.hintPolicy, hints: original.hintPolicy.hints.map((hint) => hint.id === "mass-ratio" ? { ...hint, text: "2Mg : 2MgO simplifies to 1:1. Each mole of Mg forms one mole of MgO." } : hint) },
    publication: { ...original.publication, contentHash: "" },
  };
  return { ...component, publication: { ...component.publication, contentHash: computeContentHash(component) } };
}

describe("dynamic component registry", () => {
  it("merges validated local snapshots and selects the newest compatible version", async () => {
    const local = new LocalDemoRegistryProvider("http://127.0.0.1:4175", async () => new Response(JSON.stringify({ ok: true, components: [dynamicV110()] }), { status: 200, headers: { "content-type": "application/json" } }));
    const merged = await loadMergedRegistry([new StaticBundledRegistryProvider(), local]);

    expect(merged.get("stoichiometric-product-mass")?.version).toBe("1.1.0");
    expect(merged.sourceOf("stoichiometric-product-mass", "1.1.0")).toBe("LOCAL_DEMO_REGISTRY");
  });

  it("selects governed support by first pedagogical error and component version", () => {
    const oldComponent = structuredClone((massSnapshot as { readonly component: PublishedDiagnosticLearningComponent }).component);
    const trace = {
      traceId: "trace-1", attemptId: "attempt-1", componentId: oldComponent.id,
      componentVersion: oldComponent.version, componentContentHash: oldComponent.publication.contentHash,
      runtimeVersion: "1.0.0", decision: "STUDENT_ERROR" as const,
      failureCode: "WRONG_STOICHIOMETRIC_RATIO" as const, firstPedagogicalError: "FORMULA" as const,
      evidence: [], submittedAt: "2026-07-16T10:00:00.000Z",
    };

    expect(selectSupportHint(oldComponent, trace)?.text).toBe("Compare the coefficients of Mg and MgO in the balanced equation.");
    expect(selectSupportHint(dynamicV110(), { ...trace, componentVersion: "1.1.0" })?.text).toBe("2Mg : 2MgO simplifies to 1:1. Each mole of Mg forms one mole of MgO.");
  });

  it("fails closed when a dynamic snapshot is not canonically valid", async () => {
    const invalid = { ...dynamicV110(), publication: { ...dynamicV110().publication, contentHash: "tampered" } };
    const local = new LocalDemoRegistryProvider("http://127.0.0.1:4175", async () => new Response(JSON.stringify({ ok: true, components: [invalid] }), { status: 200 }));
    await expect(local.load()).rejects.toThrow("CONTENT_HASH_MISMATCH");
  });
});
