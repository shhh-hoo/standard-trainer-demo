import type { AttemptRecord, PersistenceStatus } from "./types";
import {
  isArchivePayload,
  isAttemptRecord,
  type ArchivePayload,
} from "./archiveValidation";

export const ATTEMPT_ARCHIVE_STORAGE_KEY = "standard-trainer-demo:attempts:v1";
const ARCHIVE_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveAttemptResult {
  readonly attempt: AttemptRecord | null;
  readonly persistenceStatus: PersistenceStatus;
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

      const parsed: unknown = JSON.parse(raw);
      if (!isArchivePayload(parsed) || parsed.version !== ARCHIVE_VERSION) {
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

  save(attempt: unknown): SaveAttemptResult {
    if (!isAttemptRecord(attempt)) {
      return {
        attempt: null,
        persistenceStatus: "FAILED",
      };
    }

    try {
      JSON.stringify(attempt);
    } catch {
      return {
        attempt: null,
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

export function exportAttemptJson(attempt: unknown): string {
  if (!isAttemptRecord(attempt)) {
    throw new Error("Cannot export an invalid attempt record.");
  }

  return JSON.stringify(attempt, null, 2);
}
