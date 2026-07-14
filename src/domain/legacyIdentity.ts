import type { LegacyRuntimeContext } from "./types";

const CONTENT_ID_VERSION = "v1";
const EMPTY_PART_FALLBACK = "unknown";

function normalizeContentIdPart(value: unknown, fallback = EMPTY_PART_FALLBACK): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function normalizeInteger(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

/** Frozen port of student-site/learning-state-id.mjs buildStableContentId. */
export function buildLegacyCanonicalContentId(context: LegacyRuntimeContext): string {
  const parts = [
    "mb",
    "canonical",
    CONTENT_ID_VERSION,
    normalizeContentIdPart(context.stage),
    normalizeContentIdPart(context.levelId),
    normalizeContentIdPart(context.topicSlug),
    normalizeContentIdPart(context.fileId),
    normalizeContentIdPart(context.sourceId),
    normalizeContentIdPart(context.kind || context.type),
  ];

  if (context.round !== undefined && context.round !== null) {
    parts.push(`round-${normalizeContentIdPart(context.round)}`);
  }

  parts.push(`blank-${normalizeInteger(context.blankIndex)}`);
  return parts.join(":");
}
