import { buildLegacyCanonicalContentId } from "./legacyIdentity";
import type {
  LegacyIdentityMapping,
  LegacyMemorisationItem,
  LegacyProgressRecord,
  LegacyProgressSnapshot,
  StandardNode,
} from "./types";

export interface LegacyImportPreview {
  readonly mapping: LegacyIdentityMapping;
  readonly progress: LegacyProgressRecord | null;
}

export function previewLegacyProgressImport(
  snapshot: LegacyProgressSnapshot,
  items: readonly LegacyMemorisationItem[],
  standardNode: StandardNode,
): readonly LegacyImportPreview[] {
  return items.map((item) => {
    const generatedCanonicalId = buildLegacyCanonicalContentId(item.runtimeContext);
    const linked = standardNode.legacyContentIds.includes(item.id);

    return {
      mapping: {
        legacyItemId: item.id,
        legacyCanonicalContentId: generatedCanonicalId,
        standardNodeId: linked ? standardNode.id : null,
        migrationNotes: linked
          ? "Identity retained for a trainable Demo PR 1 Standard Node."
          : "Identity retained for adapter coverage only; no trainable Standard Node is assigned in Demo PR 1.",
      },
      progress: snapshot.records[generatedCanonicalId] ?? null,
    };
  });
}
