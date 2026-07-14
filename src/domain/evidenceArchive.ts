import type { AttemptRecord, PersistenceStatus } from "./types";

export const ATTEMPT_ARCHIVE_STORAGE_KEY = "standard-trainer-demo:attempts:v1";
const ARCHIVE_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ArchivePayload {
  readonly version: 1;
  readonly attempts: readonly AttemptRecord[];
}

export interface SaveAttemptResult {
  readonly attempt: AttemptRecord;
  readonly persistenceStatus: PersistenceStatus;
}

function isAttemptRecord(value: unknown): value is AttemptRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AttemptRecord>;
  return Boolean(
    candidate.attemptId &&
      candidate.legacyItemId &&
      candidate.standardNodeId &&
      candidate.firstResponse &&
      candidate.firstJudgement &&
      candidate.trace &&
      candidate.createdAt &&
      candidate.updatedAt,
  );
}

function replaceAttempt(
  attempts: readonly AttemptRecord[],
  incoming: AttemptRecord,
): AttemptRecord[] {
  const next = attempts.filter((attempt) => attempt.attemptId !== incoming.attemptId);
  next.push(incoming);
  return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function applyPersistenceStatus(
  attempt: AttemptRecord,
  persistenceStatus: PersistenceStatus,
): AttemptRecord {
  return {
    ...attempt,
    persistenceStatus,
    trace: { ...attempt.trace, persistenceStatus },
  };
}

export class AttemptArchive {
  private attempts: AttemptRecord[] = [];
  private storageUsable: boolean;

  constructor(private readonly storage?: StorageLike) {
    this.storageUsable = Boolean(storage);

    if (!storage) {
      return;
    }

    try {
      const raw = storage.getItem(ATTEMPT_ARCHIVE_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ArchivePayload>;
      if (
        parsed.version !== ARCHIVE_VERSION ||
        !Array.isArray(parsed.attempts) ||
        !parsed.attempts.every(isAttemptRecord)
      ) {
        this.storageUsable = false;
        return;
      }

      this.attempts = parsed.attempts.slice();
    } catch {
      this.storageUsable = false;
    }
  }

  list(): readonly AttemptRecord[] {
    return this.attempts.slice();
  }

  save(attempt: AttemptRecord): SaveAttemptResult {
    if (!isAttemptRecord(attempt)) {
      const invalidAttempt = attempt as unknown as Record<string, unknown>;
      return {
        attempt: { ...invalidAttempt, persistenceStatus: "FAILED" } as unknown as AttemptRecord,
        persistenceStatus: "FAILED",
      };
    }

    try {
      JSON.stringify(attempt);
    } catch {
      return {
        attempt: applyPersistenceStatus(attempt, "FAILED"),
        persistenceStatus: "FAILED",
      };
    }

    if (!this.storageUsable || !this.storage) {
      const memoryAttempt = applyPersistenceStatus(attempt, "MEMORY_ONLY");
      this.attempts = replaceAttempt(this.attempts, memoryAttempt);
      return { attempt: memoryAttempt, persistenceStatus: "MEMORY_ONLY" };
    }

    const persistedAttempt = applyPersistenceStatus(attempt, "PERSISTED");
    const nextAttempts = replaceAttempt(this.attempts, persistedAttempt);

    try {
      const payload: ArchivePayload = { version: ARCHIVE_VERSION, attempts: nextAttempts };
      const serialized = JSON.stringify(payload);
      this.storage.setItem(ATTEMPT_ARCHIVE_STORAGE_KEY, serialized);
      this.attempts = nextAttempts;
      return { attempt: persistedAttempt, persistenceStatus: "PERSISTED" };
    } catch {
      this.storageUsable = false;
      const memoryAttempt = applyPersistenceStatus(attempt, "MEMORY_ONLY");
      this.attempts = replaceAttempt(this.attempts, memoryAttempt);
      return { attempt: memoryAttempt, persistenceStatus: "MEMORY_ONLY" };
    }
  }
}

export function exportAttemptJson(attempt: AttemptRecord): string {
  if (!isAttemptRecord(attempt)) {
    throw new Error("Cannot export an invalid attempt record.");
  }

  return JSON.stringify(attempt, null, 2);
}
