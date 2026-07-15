# Foundry integration

Learning Foundry runs `npm run export:components` and then `npm run sync:trainer`. The sync copies only generated `manifest.json` and immutable Kp and mass snapshots into `src/published-components`. Drafts, failed generation samples, Foundry UI, and component evaluation reports stay upstream.

The consumer registry exposes:

```ts
interface PublishedComponentRegistry {
  list(): readonly PublishedDiagnosticLearningComponent[];
  get(componentId: string, version?: string):
    PublishedDiagnosticLearningComponent | null;
}
```

Snapshot JSON is treated as unknown input. The loader unwraps the generated envelope, validates required fields and publication status, recomputes the hash, compares the manifest entry, checks runtime capability, validates internal references, and only then exposes the component. Trainer attempts pin component ID and version; traces also record the publication hash and runtime version.

Foundry schema validity and Trainer capability compatibility are separate. A schema-valid `PH` component is still rejected because this runtime has no verified `PH` adapter.

