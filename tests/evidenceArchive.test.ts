import { describe, expect, it } from "vitest";
import { evaluateCalculationPath } from "../src/domain/calculationPathEngine";
import {
  CALCULATION_TRACE_STORAGE_KEY,
  CalculationTraceArchive,
  exportTraceJson,
  type StorageLike,
} from "../src/domain/evidenceArchive";
import { kpFromEquilibriumMoles } from "../src/fixtures/kpFromEquilibriumMoles";

class MemoryStorage implements StorageLike {
  readonly writes: string[] = [];
  private readonly values = new Map<string, string>();

  seed(key: string, value: string): void {
    this.values.set(key, value);
  }

  peek(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push(key);
    this.values.set(key, value);
  }
}

function validTrace() {
  return evaluateCalculationPath(kpFromEquilibriumMoles, {
    attemptId: "attempt-archive",
    submittedAt: "2026-07-14T03:00:00.000Z",
    steps: {
      totalMoles: { numericValue: 1, unit: "mol" },
      moleFractionN2O4: { numericValue: 0.4 },
      moleFractionNO2: { numericValue: 0.6 },
      partialPressureN2O4: { numericValue: 200, unit: "kPa" },
      partialPressureNO2: { numericValue: 300, unit: "kPa" },
      kpExpression: { expression: "p(NO2)^2/p(N2O4)" },
      kpResult: { numericValue: 450, unit: "kPa", significantFigures: 3 },
    },
  });
}

describe("calculation evidence archive", () => {
  it("persists and exports a versioned calculation-path trace", () => {
    const storage = new MemoryStorage();
    const archive = new CalculationTraceArchive(storage);
    const saved = archive.save(validTrace());

    expect(saved.persistenceStatus).toBe("PERSISTED");
    expect(storage.writes).toEqual([CALCULATION_TRACE_STORAGE_KEY]);
    expect(JSON.parse(exportTraceJson(saved.trace))).toMatchObject({
      problemDefinitionId: "KP_FROM_EQUILIBRIUM_MOLES",
      problemDefinitionVersion: "1.0.0",
      solutionGraphVersion: "1.0.0",
      engineVersion: "1.0.0",
      persistenceStatus: "PERSISTED",
    });
  });

  it("keeps an exportable memory-only trace when browser storage throws", () => {
    const archive = new CalculationTraceArchive({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });
    const saved = archive.save(validTrace());

    expect(saved.persistenceStatus).toBe("MEMORY_ONLY");
    expect(saved.trace?.persistenceStatus).toBe("MEMORY_ONLY");
    expect(archive.list()).toHaveLength(1);
    expect(() => exportTraceJson(saved.trace)).not.toThrow();
  });

  it("does not expose or overwrite a parseable archive with a malformed nested trace", () => {
    const storage = new MemoryStorage();
    const corrupted = JSON.stringify({
      version: 1,
      traces: [{ ...validTrace(), stepEvaluations: true }],
    });
    storage.seed(CALCULATION_TRACE_STORAGE_KEY, corrupted);

    const archive = new CalculationTraceArchive(storage);
    expect(archive.list()).toEqual([]);
    expect(archive.save(validTrace()).persistenceStatus).toBe("MEMORY_ONLY");
    expect(storage.writes).toEqual([]);
    expect(storage.peek(CALCULATION_TRACE_STORAGE_KEY)).toBe(corrupted);
  });

  it("returns FAILED instead of archiving or exporting an invalid trace", () => {
    const archive = new CalculationTraceArchive(new MemoryStorage());
    const invalid = { ...validTrace(), problemDefinitionVersion: "" };

    const saved = archive.save(invalid);
    expect(saved).toEqual({ trace: null, persistenceStatus: "FAILED" });
    expect(archive.list()).toEqual([]);
    expect(() => exportTraceJson(invalid)).toThrow(
      "Cannot export an invalid calculation evidence trace.",
    );
  });
});
