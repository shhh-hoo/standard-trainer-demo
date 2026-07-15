# Standard Trainer Demo

Standard Trainer is a deterministic runtime that consumes published diagnostic learning components and evaluates learner evidence against their authored reasoning contracts.

Learning Foundry is the upstream authority for governed learning components. This repository is its first downstream runtime; it does not author, review, modify, or publish component definitions.

## Published capability

The default UI loads an immutable Foundry registry and lets the learner select:

- **Kp from equilibrium amounts** — migrated from `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD`;
- **Stoichiometric product mass** — an expert-authored `2Mg + O₂ → 2MgO` mass calculation.

The runtime supports `KP` and `MASS` target adapters, structured learner evidence, authored fact checks, reasoning-link requirements, target checks, deterministic arithmetic, units, significant figures, and versioned evidence traces. Unsupported target kinds, unmanifested snapshots, unresolved references, and content-hash mismatches fail closed.

The separately tested V2 component inspector from the previous release remains available with `?view=inspector`. It exposes the legacy Kp manifest, capability preflight, typed invocation envelope, developer fixtures, and structured result envelope; it is not the learner-facing published registry.

## Reliable core retained

The frozen V0.1 calculation-path assets and tests remain in the repository. The V2 deterministic domain core continues to run its migrated Kp regression fixtures. Its former exact serialized-gold gate has been replaced by structural, cross-reference, expression, and policy validation; immutable Foundry snapshots now provide publication identity at the new runtime boundary.

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

This is a bounded static runtime, not a general Chemistry solver or LMS. It does not accept arbitrary generated components, arbitrary questions, free-form reasoning, handwriting, OCR, general symbolic algebra, or general ECF judgement. It has no server, authentication, database, or tamper-proof evidence store. The demo content hash detects snapshot mutation within this boundary; it is not a cryptographic identity or signature.

See [Architecture](docs/ARCHITECTURE.md), [Demo](docs/DEMO.md), [V2 Domain Core](docs/V2_DOMAIN_CORE.md), [V2 Component Boundary](docs/COMPONENT_BOUNDARY.md), and [Foundry Integration](docs/FOUNDRY_INTEGRATION.md).

