# Standard Trainer Demo

Standard Trainer is a deterministic runtime that consumes published diagnostic learning components and evaluates learner evidence against their authored reasoning contracts.

Learning Foundry is the upstream authority for governed learning components. This repository is its first downstream runtime; it does not author, review, modify, or publish component definitions.

## Published capability

The default UI loads an immutable Foundry registry and lets the learner select:

- **Kp from equilibrium amounts** — a simplified Foundry migration from `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD`, providing bounded happy-path compatibility with explicit omitted V2 capabilities;
- **Stoichiometric product mass** — an expert-authored `2Mg + O₂ → 2MgO` mass calculation.

The runtime supports `KP` and `MASS` target adapters, structured learner evidence, authored fact checks, reasoning-link requirements, target checks, deterministic arithmetic, units, significant figures, and versioned evidence traces. Unsupported target kinds, unmanifested snapshots, unresolved references, and content-hash mismatches fail closed.

The separately tested V2 component inspector from the previous release remains available with `?view=inspector`. It exposes the legacy Kp manifest, capability preflight, typed invocation envelope, developer fixtures, and structured result envelope; it is not the learner-facing published registry.

## Local dynamic registry

When `VITE_DEMO_REGISTRY_URL` is set by the Learning Foundry localhost launcher, Standard Trainer loads bundled components first and then fetches local snapshots. Every dynamic snapshot passes the existing canonical schema, content-hash, capability and adapter validation boundary. Valid id/version entries are merged, and each component id defaults to its highest compatible semantic version. Invalid dynamic content fails closed to the static registry.

The runtime selects recommended support only after diagnosis: `selectSupportHint(component, trace)` uses `firstPedagogicalError` to choose a governed hint and never treats hint text as diagnosis. In the product story, v1.0.0 returns the original ratio hint while v1.1.0 returns the strengthened explicit 1:1 transfer.

The Diagnosis API also loads the five schema-validated, school-authored 9701 calculation cases in `cases/`. They are exposed through read-only `GET /cases` and `GET /cases/:caseId` endpoints with the explicit classification `GOVERNED_CASE_NOT_LIVE_STUDENT_EVIDENCE`. Loading or reading a case never creates a Diagnosis trace or learner evidence. Completed Diagnoses remain independently resolvable through `GET /diagnoses/:traceId`.

`?embedded=1` provides the clean Demo Shell surface and emits `RUNTIME_COMPONENT_SELECTED` and `RUNTIME_DIAGNOSIS_COMPLETED` to the configured parent origin. The legacy `?view=inspector` route is unchanged.

## Reliable core retained

The frozen V0.1 calculation-path assets and tests remain in the repository. The legacy V2 deterministic domain core continues to run its full Kp gold and adversarial fixtures. The separate Foundry-published Kp adapter proves bounded structured happy-path decision parity only; its migration metadata explicitly records omitted V2 capabilities. Immutable Foundry snapshots provide publication identity at that new runtime boundary.

## Architecture

```text
Foundry manifest + published snapshots
→ schema and content-hash validation
→ capability and internal-reference validation
→ immutable component registry
→ KP or MASS target adapter
→ shared structured checks
→ first pedagogical error
→ version-pinned learner evidence trace
```

The adapters share fact, strategy, reasoning-link, arithmetic, target, unit, precision, and trace logic. Stoichiometric ratio logic remains inside `MassStoichiometryTargetAdapter`; target-specific rules are not duplicated into a second diagnosis engine.

## Verification

```bash
npm ci
npm run check
npm test
npm run build
```

## Explicit limitations

This is a bounded runtime, not a general Chemistry solver or LMS. The online build is static; localhost may connect to Learning Foundry's in-memory demo registry. It does not accept arbitrary generated components, arbitrary questions, free-form reasoning, handwriting, OCR, general symbolic algebra, or general ECF judgement. It has no authentication, database, production registry or tamper-proof evidence store. The demo content hash detects snapshot mutation within this boundary; it is not a cryptographic identity or signature.

See [Architecture](docs/ARCHITECTURE.md), [Demo](docs/DEMO.md), [V2 Domain Core](docs/V2_DOMAIN_CORE.md), [V2 Component Boundary](docs/COMPONENT_BOUNDARY.md), and [Foundry Integration](docs/FOUNDRY_INTEGRATION.md).
