import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LearnerDiagnosisTraceRepository } from "../scripts/lib/learner-diagnosis-trace-repository";

describe("LearnerDiagnosisTraceRepository", () => {
  it("retrieves a complete diagnosis by id after repository re-instantiation", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "diagnosis-traces-"));
    const record = {
      traceId: "diagnosis-trace-1",
      request: {
        componentId: "stoichiometric-product-mass",
        problemContext: {
          prompt: "Calculate the mass of MgO formed.",
          reactionEquation: "2Mg + O2 -> 2MgO",
          givenValues: [{ label: "mass Mg", value: 4.8, unit: "g" }],
          targetQuantity: "mass MgO",
          answerRequirement: "3 significant figures",
        },
        attempt: { attemptId: "attempt-1" },
      },
      component: { id: "stoichiometric-product-mass", version: "1.0.0", contentHash: "lfh1-test" },
      runtimeVersion: "standard-trainer-runtime-1.0.0",
      diagnosis: { decision: "STUDENT_ERROR", firstPedagogicalIssue: "STRATEGY", failureCode: "WRONG_METHOD", evidence: ["wrong ratio"] },
      recommendedSupport: "Use the balanced equation ratio.",
      timestamp: "2026-07-16T00:00:00.000Z",
    } as const;

    await new LearnerDiagnosisTraceRepository(directory).save(record);
    await expect(new LearnerDiagnosisTraceRepository(directory).get(record.traceId)).resolves.toEqual(record);
    await expect(new LearnerDiagnosisTraceRepository(directory).list()).resolves.toEqual([record]);
  });

  it("writes immutable files and excludes secret-shaped fields", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "diagnosis-traces-"));
    const repository = new LearnerDiagnosisTraceRepository(directory);
    const record = {
      traceId: "diagnosis-trace-immutable",
      request: { componentId: "component", problemContext: {}, attempt: { reasoning_content: "private", apiKey: "sk-secret" } },
      component: { id: "component", version: "1", contentHash: "hash" },
      runtimeVersion: "runtime",
      diagnosis: {}, recommendedSupport: null, timestamp: "2026-07-16T00:00:00.000Z",
    } as const;
    await repository.save(record);
    await expect(repository.save(record)).rejects.toThrow("DIAGNOSIS_TRACE_EXISTS");
    const stored = await readFile(path.join(directory, `${record.traceId}.json`), "utf8");
    expect(stored).not.toContain("private");
    expect(stored).not.toContain("sk-secret");
  });

  it("clears persisted diagnoses only through the explicit operation", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "diagnosis-traces-"));
    const repository = new LearnerDiagnosisTraceRepository(directory);
    const record = { traceId: "diagnosis-clear", request: {}, component: { id: "c", version: "1", contentHash: "h" }, runtimeVersion: "r", diagnosis: {}, recommendedSupport: null, timestamp: "2026-07-16T00:00:00.000Z" } as const;
    await repository.save(record); await repository.clear();
    await expect(repository.get(record.traceId)).resolves.toBeNull();
  });
});
