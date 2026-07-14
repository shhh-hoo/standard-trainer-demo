import type { CalculationEvidenceTrace, PersistenceStatus } from "./types";
import { isCalculationEvidenceTrace } from "./traceValidation";

export const CALCULATION_TRACE_STORAGE_KEY =
  "standard-trainer-demo:calculation-path-traces:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveTraceResult {
  readonly trace: CalculationEvidenceTrace | null;
  readonly persistenceStatus: PersistenceStatus;
}

interface TraceArchivePayload {
  readonly version: 1;
  readonly traces: readonly CalculationEvidenceTrace[];
}

function withPersistenceStatus(
  trace: CalculationEvidenceTrace,
  persistenceStatus: PersistenceStatus,
): CalculationEvidenceTrace {
  return { ...trace, persistenceStatus };
}

function isTraceArchivePayload(value: unknown): value is TraceArchivePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.traces) &&
    candidate.traces.every(isCalculationEvidenceTrace)
  );
}

function replaceTrace(
  traces: readonly CalculationEvidenceTrace[],
  incoming: CalculationEvidenceTrace,
): CalculationEvidenceTrace[] {
  return [...traces.filter((trace) => trace.traceId !== incoming.traceId), incoming].sort(
    (left, right) => right.submittedAt.localeCompare(left.submittedAt),
  );
}

export class CalculationTraceArchive {
  private traces: CalculationEvidenceTrace[] = [];
  private storageUsable: boolean;

  constructor(private readonly storage?: StorageLike) {
    this.storageUsable = Boolean(storage);
    if (!storage) {
      return;
    }
    try {
      const raw = storage.getItem(CALCULATION_TRACE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isTraceArchivePayload(parsed)) {
        this.storageUsable = false;
        return;
      }
      this.traces = parsed.traces.slice();
    } catch {
      this.storageUsable = false;
    }
  }

  list(): readonly CalculationEvidenceTrace[] {
    return this.traces.slice();
  }

  save(trace: unknown): SaveTraceResult {
    if (!isCalculationEvidenceTrace(trace)) {
      return { trace: null, persistenceStatus: "FAILED" };
    }
    try {
      JSON.stringify(trace);
    } catch {
      return { trace: null, persistenceStatus: "FAILED" };
    }

    if (!this.storageUsable || !this.storage) {
      const memoryTrace = withPersistenceStatus(trace, "MEMORY_ONLY");
      this.traces = replaceTrace(this.traces, memoryTrace);
      return { trace: memoryTrace, persistenceStatus: "MEMORY_ONLY" };
    }

    const persistedTrace = withPersistenceStatus(trace, "PERSISTED");
    const nextTraces = replaceTrace(this.traces, persistedTrace);
    try {
      this.storage.setItem(
        CALCULATION_TRACE_STORAGE_KEY,
        JSON.stringify({ version: 1, traces: nextTraces } satisfies TraceArchivePayload),
      );
      this.traces = nextTraces;
      return { trace: persistedTrace, persistenceStatus: "PERSISTED" };
    } catch {
      this.storageUsable = false;
      const memoryTrace = withPersistenceStatus(trace, "MEMORY_ONLY");
      this.traces = replaceTrace(this.traces, memoryTrace);
      return { trace: memoryTrace, persistenceStatus: "MEMORY_ONLY" };
    }
  }
}

export function exportTraceJson(trace: unknown): string {
  if (!isCalculationEvidenceTrace(trace)) {
    throw new Error("Cannot export an invalid calculation evidence trace.");
  }
  return JSON.stringify(trace, null, 2);
}
