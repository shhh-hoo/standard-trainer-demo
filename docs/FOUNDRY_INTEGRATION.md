# Foundry integration

Learning Foundry runs `npm run export:components` and then `npm run sync:trainer`. The sync copies the generated canonical JSON Schema, `manifest.json`, and immutable Kp and mass snapshots into `src/published-components`. Drafts, failed generation samples, Foundry UI, and Component Contract Check reports stay upstream.

The consumer registry exposes:

```ts
interface PublishedComponentRegistry {
  list(): readonly PublishedDiagnosticLearningComponent[];
  get(componentId: string, version?: string):
    PublishedDiagnosticLearningComponent | null;
}
```

Snapshot JSON is treated as unknown input. The loader unwraps the generated envelope, validates every nested field against the canonical schema, requires publication metadata, enforces unique manifest IDs and files plus an exact file-to-component bijection, recomputes the hash, checks runtime capability and internal references, and only then exposes the component. Trainer attempts pin component ID and version; traces also record the publication hash and runtime version.

The published Kp component is a simplified migration. Its adapter demonstrates happy-path decision parity with the legacy V2 core; omitted V2 capabilities are recorded in the component's migration metadata.

Foundry schema validity and Trainer capability compatibility are separate. A schema-valid `PH` component is still rejected because this runtime has no verified `PH` adapter.
