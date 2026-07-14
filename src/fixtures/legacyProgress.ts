import type { LegacyProgressSnapshot } from "../domain/types";
import { SNAPSHOT_GENERATED_AT } from "./provenance";

export const legacyProgressSnapshot = Object.freeze<LegacyProgressSnapshot>({
  version: 1,
  snapshotGeneratedAt: SNAPSHOT_GENERATED_AT,
  records: Object.freeze({
    "mb:canonical:v1:as:level-1-core:equilibrium:core-definitions:as-def-045:single:blank-0":
      Object.freeze({
        canonicalContentId:
          "mb:canonical:v1:as:level-1-core:equilibrium:core-definitions:as-def-045:single:blank-0",
        status: "reviewing",
        correctCount: 1,
        wrongCount: 2,
        nextReviewAt: "2026-07-15T00:00:00.000Z",
      }),
    "mb:canonical:v1:as:level-1-core:equilibrium:core-fixed-conclusions:as-fc-001:single:blank-0":
      Object.freeze({
        canonicalContentId:
          "mb:canonical:v1:as:level-1-core:equilibrium:core-fixed-conclusions:as-fc-001:single:blank-0",
        status: "learning",
        correctCount: 2,
        wrongCount: 0,
        nextReviewAt: "2026-07-18T00:00:00.000Z",
      }),
  }),
});
