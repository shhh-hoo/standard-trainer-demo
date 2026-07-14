import { describe, expect, it } from "vitest";
import { buildLegacyCanonicalContentId } from "../src/domain/legacyIdentity";
import {
  legacyDynamicEquilibriumDefinition,
  legacyPressureFixedConclusion,
} from "../src/fixtures/legacyItems";
import {
  fixtureProvenance,
  identityAlgorithmProvenance,
  SNAPSHOT_GENERATED_AT,
} from "../src/fixtures/provenance";

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

  it("retains the frozen helper's empty-context defaults", () => {
    expect(buildLegacyCanonicalContentId()).toBe(
      "mb:canonical:v1:unknown:unknown:unknown:unknown:unknown:unknown:blank-0",
    );
  });

  it("supports every fallback field from the frozen helper", () => {
    expect(
      buildLegacyCanonicalContentId({
        stage: "AS",
        level: "Level 2",
        topic: "Equilibrium",
        packId: "Pack A",
        id: "Question 7",
        type: "Multi Blank",
        blankIndex: 2,
      }),
    ).toBe("mb:canonical:v1:as:level-2:equilibrium:pack-a:question-7:multi-blank:blank-2");
  });

  it("uses the frozen field precedence when preferred and fallback fields coexist", () => {
    expect(
      buildLegacyCanonicalContentId({
        stage: "AS",
        levelId: "preferred-level",
        level: "fallback-level",
        topicSlug: "preferred-topic",
        topic: "fallback-topic",
        fileId: "fallback-file",
        packId: "preferred-pack",
        sourceId: "fallback-source",
        canonicalSourceId: "preferred-source",
        id: "last-source-fallback",
        kind: "preferred-kind",
        type: "fallback-type",
      }),
    ).toBe(
      "mb:canonical:v1:as:preferred-level:preferred-topic:preferred-pack:preferred-source:preferred-kind:blank-0",
    );
  });

  it.each([undefined, null, ""])("excludes an empty round value (%s)", (round) => {
    expect(
      buildLegacyCanonicalContentId({
        stage: "AS",
        levelId: "level-1",
        topicSlug: "equilibrium",
        fileId: "definitions",
        sourceId: "as-def-045",
        kind: "single",
        round,
      }),
    ).toBe("mb:canonical:v1:as:level-1:equilibrium:definitions:as-def-045:single:blank-0");
  });

  it("includes and normalizes a duplicate key", () => {
    expect(
      buildLegacyCanonicalContentId({
        stage: "AS",
        levelId: "level-1",
        topicSlug: "equilibrium",
        fileId: "definitions",
        sourceId: "as-def-045",
        kind: "single",
        round: 2,
        blankIndex: 1,
        duplicateKey: "Copy #2",
      }),
    ).toBe(
      "mb:canonical:v1:as:level-1:equilibrium:definitions:as-def-045:single:round-2:blank-1:dup-copy-2",
    );
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
    expect(identityAlgorithmProvenance).toMatchObject({
      repository: "shhh-hoo/student-site",
      commitSha: "b514b1c770bac0906632408a7fec8a7da50a4427",
      filePath: "interactive/9701-memorisation-bank/learning-state-id.mjs",
      gitBlobSha: "cef4e5e6eaf943241e4a6b2b7fbaa7aded0de44c",
      snapshotGeneratedAt: SNAPSHOT_GENERATED_AT,
    });
  });
});
