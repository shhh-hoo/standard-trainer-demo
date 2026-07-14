import { describe, expect, it } from "vitest";
import {
  ATTEMPT_ARCHIVE_STORAGE_KEY,
  AttemptArchive,
  exportAttemptJson,
  type StorageLike,
} from "../src/domain/evidenceArchive";
import type { AttemptRecord } from "../src/domain/types";
import { createWorkflowState, submitFirstAnswer, type WorkflowDependencies } from "../src/domain/workflow";
import { activeDynamicEquilibriumStandard } from "../src/fixtures/dynamicEquilibriumStandard";
import { legacyDynamicEquilibriumDefinition } from "../src/fixtures/legacyItems";

function createAttempt() {
  const dependencies: WorkflowDependencies = {
    activeStandard: activeDynamicEquilibriumStandard,
    legacyItem: legacyDynamicEquilibriumDefinition,
    curriculum: {
      board: "Cambridge International",
      syllabusCode: "9701",
      syllabusCycle: "2025-2027",
    },
    now: () => "2026-07-14T01:00:00.000Z",
    createId: (kind) => `${kind}-archive-test`,
  };
  return submitFirstAnswer(
    createWorkflowState(),
    "In a closed system, both reactions continue at the same rate and concentrations remain constant.",
    dependencies,
  ).attempt!;
}

class MemoryStorage implements StorageLike {
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    this.reads.push(key);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.writes.push(key);
    this.values.set(key, value);
  }
}

describe("attempt evidence archive", () => {
  it("persists and exports one complete trace without touching mb keys", () => {
    const storage = new MemoryStorage();
    const archive = new AttemptArchive(storage);
    const saved = archive.save(createAttempt());
    expect(saved.persistenceStatus).toBe("PERSISTED");
    expect(storage.reads).toEqual([ATTEMPT_ARCHIVE_STORAGE_KEY]);
    expect(storage.writes).toEqual([ATTEMPT_ARCHIVE_STORAGE_KEY]);
    expect(storage.reads.some((key) => key.startsWith("mb:"))).toBe(false);
    expect(storage.writes.some((key) => key.startsWith("mb:"))).toBe(false);

    const exported = JSON.parse(exportAttemptJson(saved.attempt));
    expect(exported.firstJudgement.decision).toBe("PASS");
    expect(exported.authorityScope).toBe("DRAFT_RUBRIC_ONLY");
    expect(exported.trace.rubricVersion).toBe("de-v0.1");
    expect(exported.trace.persistenceStatus).toBe("PERSISTED");
  });

  it("falls back to memory-only evidence when localStorage throws", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    const archive = new AttemptArchive(storage);
    const saved = archive.save(createAttempt());
    expect(saved.persistenceStatus).toBe("MEMORY_ONLY");
    expect(saved.attempt.persistenceStatus).toBe("MEMORY_ONLY");
    expect(archive.list()).toHaveLength(1);
    expect(() => exportAttemptJson(saved.attempt)).not.toThrow();
  });

  it("treats corrupted existing storage as memory-only and does not overwrite it", () => {
    let writes = 0;
    const storage: StorageLike = {
      getItem: () => "{broken-json",
      setItem: () => {
        writes += 1;
      },
    };
    const archive = new AttemptArchive(storage);
    const saved = archive.save(createAttempt());
    expect(saved.persistenceStatus).toBe("MEMORY_ONLY");
    expect(writes).toBe(0);
  });

  it("reports FAILED for an invalid attempt instead of claiming an archive", () => {
    const archive = new AttemptArchive(new MemoryStorage());
    const invalid = { ...createAttempt(), attemptId: "" };
    const saved = archive.save(invalid);
    expect(saved.persistenceStatus).toBe("FAILED");
    expect(archive.list()).toHaveLength(0);
  });

  it("reports FAILED when an otherwise shaped record cannot be serialized", () => {
    const archive = new AttemptArchive(new MemoryStorage());
    const cyclic = createAttempt() as AttemptRecord & { cycle?: unknown };
    cyclic.cycle = cyclic;
    const saved = archive.save(cyclic);
    expect(saved.persistenceStatus).toBe("FAILED");
    expect(saved.attempt.trace.persistenceStatus).toBe("FAILED");
    expect(archive.list()).toHaveLength(0);
  });
});
