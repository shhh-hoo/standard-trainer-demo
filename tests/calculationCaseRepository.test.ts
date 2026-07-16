import path from "node:path";
import { describe, expect, it } from "vitest";
import { CalculationCaseRepository } from "../scripts/lib/calculation-case-repository";
import { StaticBundledRegistryProvider, createDiagnosisApiHandler, loadMergedRegistry } from "../src/foundry-runtime";

describe("governed calculation case repository", () => {
  it("loads and schema-validates the five original cases without treating them as learner evidence", async () => {
    const repository = await CalculationCaseRepository.load(path.resolve("cases"));
    const records = await repository.list();
    expect(records).toHaveLength(5);
    expect(records.map((record) => record.caseId)).toEqual([
      "CASE-LIMITING-001",
      "CASE-MULTISTAGE-001",
      "CASE-PURITY-001",
      "CASE-STOICH-001",
      "CASE-TITRATION-001",
    ]);
    expect(records.every((record) => record.distributionScope === "PUBLIC_ORIGINAL")).toBe(true);

    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    const diagnoses: unknown[] = [];
    const diagnosisStore = { save: async (record: unknown) => { diagnoses.push(record); }, get: async () => null, list: async () => diagnoses };
    const handle = createDiagnosisApiHandler({ registry }, diagnosisStore, repository);
    const response = await handle(new Request("http://127.0.0.1:4177/cases/CASE-STOICH-001"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, case: { caseId: "CASE-STOICH-001" }, evidenceClassification: "GOVERNED_CASE_NOT_LIVE_STUDENT_EVIDENCE" });
    expect(diagnoses).toEqual([]);
  });

  it("reports a governed case count at health without exposing case data as a diagnosis", async () => {
    const repository = await CalculationCaseRepository.load(path.resolve("cases"));
    const registry = await loadMergedRegistry([new StaticBundledRegistryProvider()]);
    const handle = createDiagnosisApiHandler({ registry }, undefined, repository);
    await expect((await handle(new Request("http://127.0.0.1:4177/health"))).json()).resolves.toMatchObject({ governedCaseCount: 5 });
    await expect((await handle(new Request("http://127.0.0.1:4177/diagnoses"))).json()).resolves.toEqual({ ok: true, diagnoses: [] });
  });
});
