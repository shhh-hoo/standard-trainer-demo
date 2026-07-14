import { describe, expect, it } from "vitest";
import { buildLegacyCanonicalContentId } from "../src/domain/legacyIdentity";
import {
  legacyDynamicEquilibriumDefinition,
  legacyPressureFixedConclusion,
} from "../src/fixtures/legacyItems";
import { fixtureProvenance, SNAPSHOT_GENERATED_AT } from "../src/fixtures/provenance";

describe("frozen Student Site identity algorithm", () => {
  it.each([
    [
      legacyDynamicEquilibriumDefinition,
      "mb:canonical:v1:as:level-1-core:equilibrium:core-definitions:as-def-045:single:blank-0",
    ],
    [
      legacyPressureFixedConclusion,
      "mb:canonical:v1:as:level-1-core:equilibrium:core-fixed-conclusions:as-fc-001:single:blank-0",
    ],
  ])("generates the expected golden canonical ID for $id", (item, goldenId) => {
    expect(buildLegacyCanonicalContentId(item.runtimeContext)).toBe(goldenId);
  });

  it("keeps fixture provenance pinned to a fixed timestamp and blob identities", () => {
    expect(SNAPSHOT_GENERATED_AT).toBe("2026-07-14T00:00:00.000Z");
    expect(Object.values(fixtureProvenance).every((entry) => entry.snapshotGeneratedAt === SNAPSHOT_GENERATED_AT)).toBe(true);
    expect(Object.values(fixtureProvenance).every((entry) => entry.sourceStatus === "AI_DRAFT")).toBe(true);
    expect(fixtureProvenance.legacyDefinitions.gitBlobSha).toBe(
      "c2f7a0a34d9d48baef76d95d7bf5944b205aeaa9",
    );
    expect(fixtureProvenance.legacyFixedConclusions.gitBlobSha).toBe(
      "3a9dee2caf8364c6fa7adbb19ad7ffe495ed503d",
    );
    expect(fixtureProvenance.draftRubric.gitBlobSha).toBe(
      "5722c5ffbd1937af9cb0439d90d0df24870b7407",
    );
  });
});
