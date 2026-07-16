import { publishedComponentRegistry } from "./registry";
import type { PublishedComponentRegistry, PublishedDiagnosticLearningComponent } from "./types";
import { validatePublishedComponent } from "./validation";

export type RegistrySource = "STATIC_BUNDLED_REGISTRY" | "LOCAL_DEMO_REGISTRY";

export interface ComponentRegistryProvider {
  readonly source: RegistrySource;
  load(): Promise<readonly PublishedDiagnosticLearningComponent[]>;
}

export class StaticBundledRegistryProvider implements ComponentRegistryProvider {
  readonly source = "STATIC_BUNDLED_REGISTRY" as const;
  async load(): Promise<readonly PublishedDiagnosticLearningComponent[]> { return publishedComponentRegistry.list(); }
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class LocalDemoRegistryProvider implements ComponentRegistryProvider {
  readonly source = "LOCAL_DEMO_REGISTRY" as const;
  constructor(private readonly baseUrl: string, private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis)) {}

  async load(): Promise<readonly PublishedDiagnosticLearningComponent[]> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}/components`);
    if (!response.ok) throw new Error(`LOCAL_REGISTRY_UNAVAILABLE: HTTP ${response.status}`);
    const body = await response.json() as { readonly components?: unknown };
    if (!Array.isArray(body?.components)) throw new Error("LOCAL_REGISTRY_MALFORMED: components must be an array.");
    return body.components.map((snapshot, index) => {
      const parsed = validatePublishedComponent(snapshot);
      if (!parsed.ok) throw new Error(`LOCAL_COMPONENT_REJECTED[${index}]: ${parsed.issues.map((issue) => `${issue.code} ${issue.message}`).join("; ")}`);
      return parsed.value;
    });
  }
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number); const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return (a[index] ?? 0) - (b[index] ?? 0);
  return 0;
}

export class MergedComponentRegistry implements PublishedComponentRegistry {
  constructor(private readonly entries: readonly { readonly component: PublishedDiagnosticLearningComponent; readonly source: RegistrySource }[]) {}

  list(): readonly PublishedDiagnosticLearningComponent[] {
    const ids = [...new Set(this.entries.map((entry) => entry.component.id))];
    return ids.map((id) => this.get(id)).filter((item): item is PublishedDiagnosticLearningComponent => item !== null);
  }

  get(componentId: string, version?: string): PublishedDiagnosticLearningComponent | null {
    return this.entries.filter((entry) => entry.component.id === componentId && (!version || entry.component.version === version)).sort((left, right) => compareVersions(right.component.version, left.component.version))[0]?.component ?? null;
  }

  sourceOf(componentId: string, version: string): RegistrySource | null {
    return this.entries.find((entry) => entry.component.id === componentId && entry.component.version === version)?.source ?? null;
  }
}

export async function loadMergedRegistry(providers: readonly ComponentRegistryProvider[]): Promise<MergedComponentRegistry> {
  const entries = new Map<string, { readonly component: PublishedDiagnosticLearningComponent; readonly source: RegistrySource }>();
  for (const provider of providers) {
    const components = await provider.load();
    for (const component of components) entries.set(`${component.id}@${component.version}`, { component, source: provider.source });
  }
  return new MergedComponentRegistry([...entries.values()]);
}
