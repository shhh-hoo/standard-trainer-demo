import manifestSnapshot from "../published-components/manifest.json";
import kpSnapshot from "../published-components/kp-from-equilibrium-moles.json";
import massSnapshot from "../published-components/stoichiometric-product-mass.json";
import { validatePublishedComponent } from "./validation";
import type { PublishedComponentRegistry, PublishedDiagnosticLearningComponent } from "./types";

type UnknownRecord = Record<string, unknown>;
type ManifestEntry = { readonly id: string; readonly version: string; readonly targetKind: string; readonly contentHash: string; readonly file: string };
export interface PublishedSnapshotInput { readonly file: string; readonly snapshot: unknown }

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const componentKey = (id: string, version: string) => `${id}@${version}`;
function registryError(code: string, message: string): never { throw new Error(`${code}: ${message}`); }

function requiredString(value: UnknownRecord, key: string, context: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) throw new Error(`MALFORMED_MANIFEST_ENTRY: ${context}.${key} must be a non-empty string.`);
  return candidate;
}

function parseManifest(value: unknown): readonly ManifestEntry[] {
  if (!isRecord(value)) registryError("MALFORMED_MANIFEST", "Published component manifest must be an object.");
  const rawComponents = value.components;
  if (!Array.isArray(rawComponents)) registryError("MALFORMED_MANIFEST", "Published component manifest must contain a components array.");
  const entries = rawComponents.map((candidate: unknown, index: number) => {
    if (!isRecord(candidate)) registryError("MALFORMED_MANIFEST_ENTRY", `components[${index}] must be an object.`);
    return {
      id: requiredString(candidate, "id", `components[${index}]`),
      version: requiredString(candidate, "version", `components[${index}]`),
      targetKind: requiredString(candidate, "targetKind", `components[${index}]`),
      contentHash: requiredString(candidate, "contentHash", `components[${index}]`),
      file: requiredString(candidate, "file", `components[${index}]`),
    };
  });
  const keys = new Set<string>();
  const files = new Set<string>();
  for (const entry of entries) {
    const key = componentKey(entry.id, entry.version);
    if (keys.has(key)) registryError("DUPLICATE_MANIFEST_COMPONENT", `Manifest repeats ${key}.`);
    if (files.has(entry.file)) registryError("DUPLICATE_MANIFEST_FILE", `Manifest repeats ${entry.file}.`);
    keys.add(key);
    files.add(entry.file);
  }
  return entries;
}

const defaultSnapshots: readonly PublishedSnapshotInput[] = [
  { file: "kp-from-equilibrium-moles.json", snapshot: kpSnapshot },
  { file: "stoichiometric-product-mass.json", snapshot: massSnapshot },
];

export class ImmutablePublishedComponentRegistry implements PublishedComponentRegistry {
  private readonly components: readonly PublishedDiagnosticLearningComponent[];

  constructor(manifest: unknown = manifestSnapshot, snapshots: readonly PublishedSnapshotInput[] = defaultSnapshots) {
    const entries = parseManifest(manifest);
    const byFile = new Map<string, PublishedDiagnosticLearningComponent>();
    const componentKeys = new Set<string>();
    for (const [index, input] of snapshots.entries()) {
      if (!isRecord(input) || typeof input.file !== "string" || input.file.length === 0 || !("snapshot" in input)) registryError("MALFORMED_SNAPSHOT_INPUT", `snapshots[${index}] must bind a file to a snapshot.`);
      if (byFile.has(input.file)) registryError("DUPLICATE_SNAPSHOT_FILE", `Snapshot file ${input.file} is repeated.`);
      const parsed = validatePublishedComponent(input.snapshot);
      if (!parsed.ok) throw new Error(`PUBLISHED_COMPONENT_REJECTED: ${parsed.issues.map((item) => `${item.code} ${item.message}`).join("; ")}`);
      const component = parsed.value;
      const key = componentKey(component.id, component.version);
      if (componentKeys.has(key)) registryError("DUPLICATE_SNAPSHOT_COMPONENT", `Snapshots repeat ${key}.`);
      componentKeys.add(key);
      byFile.set(input.file, component);
    }
    const manifestFiles = new Set(entries.map((entry) => entry.file));
    for (const file of byFile.keys()) if (!manifestFiles.has(file)) registryError("UNMANIFESTED_SNAPSHOT", `${file} is not declared by the manifest.`);
    const components = entries.map((entry) => {
      const component = byFile.get(entry.file);
      const key = componentKey(entry.id, entry.version);
      if (!component) throw new Error(`MISSING_SNAPSHOT: Manifest entry ${key} has no snapshot for ${entry.file}.`);
      if (component.id !== entry.id || component.version !== entry.version) registryError("COMPONENT_FILE_MISMATCH", `${entry.file} contains ${componentKey(component.id, component.version)}, not ${key}.`);
      if (component.target.kind !== entry.targetKind) registryError("MANIFEST_TARGET_KIND_MISMATCH", `${key} has target ${component.target.kind}, not ${entry.targetKind}.`);
      if (component.publication.contentHash !== entry.contentHash) registryError("MANIFEST_HASH_MISMATCH", `${key} does not match the manifest hash.`);
      return component;
    });
    this.components = Object.freeze(components);
  }

  list(): readonly PublishedDiagnosticLearningComponent[] { return this.components; }
  get(componentId: string, version?: string): PublishedDiagnosticLearningComponent | null {
    const matches = this.components.filter((component) => component.id === componentId && (!version || component.version === version));
    return matches.sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))[0] ?? null;
  }
}

export const publishedComponentRegistry = new ImmutablePublishedComponentRegistry();
