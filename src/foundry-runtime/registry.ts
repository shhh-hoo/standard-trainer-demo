import manifestSnapshot from "../published-components/manifest.json";
import kpSnapshot from "../published-components/kp-from-equilibrium-moles.json";
import massSnapshot from "../published-components/stoichiometric-product-mass.json";
import { validatePublishedComponent } from "./validation";
import type { PublishedComponentRegistry, PublishedDiagnosticLearningComponent } from "./types";

type Manifest = { readonly components: readonly { readonly id: string; readonly version: string; readonly contentHash: string; readonly file: string }[] };

export class ImmutablePublishedComponentRegistry implements PublishedComponentRegistry {
  private readonly components: readonly PublishedDiagnosticLearningComponent[];

  constructor(manifest: unknown = manifestSnapshot, snapshots: readonly unknown[] = [kpSnapshot, massSnapshot]) {
    if (!manifest || typeof manifest !== "object" || !Array.isArray((manifest as Manifest).components)) throw new Error("Published component manifest is malformed.");
    const parsed = snapshots.map((snapshot) => validatePublishedComponent(snapshot));
    const invalid = parsed.find((result) => !result.ok);
    if (invalid && !invalid.ok) throw new Error(`Published component rejected: ${invalid.issues.map((item) => `${item.code} ${item.message}`).join("; ")}`);
    const components = parsed.flatMap((result) => result.ok ? [result.value] : []);
    for (const entry of (manifest as Manifest).components) {
      const component = components.find((item) => item.id === entry.id && item.version === entry.version);
      if (!component || component.publication.contentHash !== entry.contentHash) throw new Error(`Manifest mismatch for ${entry.id}@${entry.version}.`);
    }
    if (components.length !== (manifest as Manifest).components.length) throw new Error("Registry contains unmanifested or missing snapshots.");
    this.components = Object.freeze(components);
  }

  list(): readonly PublishedDiagnosticLearningComponent[] { return this.components; }
  get(componentId: string, version?: string): PublishedDiagnosticLearningComponent | null {
    const matches = this.components.filter((component) => component.id === componentId && (!version || component.version === version));
    return matches.sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))[0] ?? null;
  }
}

export const publishedComponentRegistry = new ImmutablePublishedComponentRegistry();
