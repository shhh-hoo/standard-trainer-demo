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
export function buildLegacyCanonicalContentId(context: LegacyRuntimeContext = {}): string {
  const {
    stage,
    levelId,
    level,
    topicSlug,
    topic,
    fileId,
    packId,
    sourceId,
    canonicalSourceId,
    id,
    kind,
    type,
    round,
    blankIndex = 0,
    duplicateKey = "",
  } = context;

  const parts = [
    "mb",
    "canonical",
    CONTENT_ID_VERSION,
    normalizeContentIdPart(stage),
    normalizeContentIdPart(levelId ?? level),
    normalizeContentIdPart(topicSlug ?? topic),
    normalizeContentIdPart(packId ?? fileId),
    normalizeContentIdPart(canonicalSourceId ?? sourceId ?? id),
    normalizeContentIdPart(kind ?? type),
  ];

  if (round !== undefined && round !== null && round !== "") {
    parts.push(`round-${normalizeContentIdPart(round)}`);
  }

  parts.push(`blank-${normalizeInteger(blankIndex)}`);

  if (duplicateKey) {
    parts.push(`dup-${normalizeContentIdPart(duplicateKey)}`);
  }

  return parts.join(":");
}
