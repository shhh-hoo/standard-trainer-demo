import type { FixtureProvenance } from "../domain/types";

export const SNAPSHOT_GENERATED_AT = "2026-07-14T00:00:00.000Z";

export const fixtureProvenance = Object.freeze({
  legacyDefinitions: Object.freeze<FixtureProvenance>({
    id: "student-site-as-equilibrium-core-definitions-b514b1c",
    legacyItemIds: Object.freeze(["as-def-045"]),
    repository: "shhh-hoo/student-site",
    commitSha: "b514b1c770bac0906632408a7fec8a7da50a4427",
    filePath:
      "interactive/9701-memorisation-bank/data/as/level-1-core/equilibrium/core-definitions.json",
    gitBlobSha: "c2f7a0a34d9d48baef76d95d7bf5944b205aeaa9",
    snapshotGeneratedAt: SNAPSHOT_GENERATED_AT,
    sourceStatus: "AI_DRAFT",
    transformationNote:
      "Selected as-def-045 only; retained source wording and supplied the runtime context used by the frozen identity algorithm.",
  }),
  legacyFixedConclusions: Object.freeze<FixtureProvenance>({
    id: "student-site-as-equilibrium-core-fixed-conclusions-b514b1c",
    legacyItemIds: Object.freeze(["as-fc-001"]),
    repository: "shhh-hoo/student-site",
    commitSha: "b514b1c770bac0906632408a7fec8a7da50a4427",
    filePath:
      "interactive/9701-memorisation-bank/data/as/level-1-core/equilibrium/core-fixed-conclusions.json",
    gitBlobSha: "3a9dee2caf8364c6fa7adbb19ad7ffe495ed503d",
    snapshotGeneratedAt: SNAPSHOT_GENERATED_AT,
    sourceStatus: "AI_DRAFT",
    transformationNote:
      "Selected as-fc-001 for migration identity coverage only; it is not trainable in Demo PR 1.",
  }),
  draftRubric: Object.freeze<FixtureProvenance>({
    id: "10-day-challenge-dynamic-equilibrium-draft-17272ba",
    legacyItemIds: Object.freeze(["as-def-045"]),
    repository: "shhh-hoo/10-Day-Challenge",
    commitSha: "17272ba51cbd3035182c443d14cb4ee5514b84fd",
    filePath: "docs/content/standard_nodes_seed.json",
    gitBlobSha: "5722c5ffbd1937af9cb0439d90d0df24870b7407",
    snapshotGeneratedAt: SNAPSHOT_GENERATED_AT,
    sourceStatus: "AI_DRAFT",
    transformationNote:
      "Converted the frozen AI-draft node into deterministic phrase patterns without changing its authority or review status.",
  }),
});
