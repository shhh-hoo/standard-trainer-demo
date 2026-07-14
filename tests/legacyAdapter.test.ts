import { describe, expect, it } from "vitest";
import { previewLegacyProgressImport } from "../src/domain/legacyAdapter";
import { dynamicEquilibriumStandardNode } from "../src/fixtures/dynamicEquilibriumStandard";
import { legacyItems } from "../src/fixtures/legacyItems";
import { legacyProgressSnapshot } from "../src/fixtures/legacyProgress";

describe("read-only legacy migration preview", () => {
  it("preserves raw IDs, generated canonical identities, and existing progress", () => {
    const preview = previewLegacyProgressImport(
      legacyProgressSnapshot,
      legacyItems,
      dynamicEquilibriumStandardNode,
    );

    expect(preview.map((entry) => entry.mapping.legacyItemId)).toEqual(["as-def-045", "as-fc-001"]);
    expect(preview[0].mapping.standardNodeId).toBe(dynamicEquilibriumStandardNode.id);
    expect(preview[1].mapping.standardNodeId).toBeNull();
    expect(preview[0].progress?.wrongCount).toBe(2);
    expect(preview[1].progress?.correctCount).toBe(2);
    expect(preview.every((entry) => entry.progress?.canonicalContentId === entry.mapping.legacyCanonicalContentId)).toBe(true);
  });
});
