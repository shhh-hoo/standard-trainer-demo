# Calculation Path Trainer

## Product statement

Calculation Path Trainer is a deterministic chemistry calculation-path diagnosis proof for Cambridge A-Level Chemistry-style structured working. It collects an authored sequence of calculation steps, checks each step against one immutable canonical solution graph, and identifies the first invalid step instead of generating a general answer.

The current release contains exactly one curated problem: `KP_FROM_EQUILIBRIUM_MOLES`. It is a bounded engine proof, not a complete learning platform.

V0.1 remains the frozen learner baseline. The `2.0.0-draft.2` modality-neutral measurement contract is documented in [V2 Measurement Contract](docs/V2_MEASUREMENT_CONTRACT.md), and its deterministic runtime is implemented in the [V2 Domain Core](docs/V2_DOMAIN_CORE.md). The runtime is now exposed through a bounded [V2 Trainer Component Boundary](docs/COMPONENT_BOUNDARY.md): manifest, capability preflight, invocation envelope, and structured result envelope. The default browser view is a developer component inspector; the legacy learner proof remains available with `?view=legacy`.

## Live Demo

[Open the verified live demo](https://shhh-hoo.github.io/standard-trainer-demo/)

## What it proves

- A versioned, immutable `ProblemDefinition` for one curated Kp calculation.
- An explicit seven-step canonical solution graph with dependency metadata.
- Deterministic numeric, curated-expression, unit, and significant-figure tools.
- First-invalid-step diagnosis; later steps are recorded as `NOT_EVALUATED`.
- Separate path decisions and failure codes.
- Runtime-validated, versioned evidence traces.
- Honest browser persistence with `PERSISTED`, `MEMORY_ONLY`, and `FAILED` states.
- JSON evidence export.
- A responsive, keyboard-accessible React workbench.
- CI-backed type checking, tests, and production builds.
- A separate V2 deterministic domain API with fail-closed input/trace validation.
- Exact engine diagnosis for 16 authored V2 gold fixtures and four explicit typed mock scenarios.
- A public trainer-component contract that distinguishes exact, partial, and unsupported requests before invocation.
- A minimal developer inspector for the manifest, capability fit, explicit mock invocation, and evidence trace.

## Explicit limitations

This proof does **not** include:

- LLM calls or agent orchestration;
- natural-language student-step parsing;
- arbitrary expression or question parsing;
- generated questions;
- hints or learner modelling;
- bounded or general error-carried-forward (ECF) judgement;
- production authentication;
- a remote backend or tamper-proof audit storage.
- a Learning Foundry shell, registry, capability-gap store, or temporary support generator.

The expression checker is a versioned whitelist matcher for the curated Kp problem, not a symbolic algebra system. The solution graph records explicit dependencies, but the current engine evaluates steps in authored canonical order. Trace validation checks shape and internal consistency; it is not a cryptographic integrity proof. Browser storage and exported JSON remain under the learner's control.

## Architecture

```text
src/domain/    Pure engine, deterministic tools, trace validation, persistence boundary
src/fixtures/  Immutable curated problem and canonical solution graph
src/component/ Public manifest, preflight, invocation, and result envelopes
src/ComponentInspector.tsx  Minimal developer component inspector
src/App.tsx    Frozen V0.1 structured-input workbench
tests/         Engine, graph, archive, and UI behavior
docs/          Architecture, case study, deployment, and demo material
```

See [Architecture](docs/ARCHITECTURE.md) for the current data flow and trust boundary, and [Calculation Path Core](docs/CALCULATION_PATH_CORE.md) for the graph contract.

## Verification

```bash
npm ci
npm run check
npm test
npm run build
```

The current suite contains 88 tests: 15 for the frozen V0.1 runtime, 15 contract-integrity checks for the V2 gold artifacts, 50 runtime/core/adapter/adversarial checks for the deterministic V2 implementation, and 8 component-boundary and inspector checks. It is verified by [GitHub Actions CI](.github/workflows/ci.yml). The calculation-path core milestone was merged in [PR #2](https://github.com/shhh-hoo/standard-trainer-demo/pull/2), the V2 contract baseline in [PR #5](https://github.com/shhh-hoo/standard-trainer-demo/pull/5), and the deterministic V2 core in [PR #6](https://github.com/shhh-hoo/standard-trainer-demo/pull/6).

## Demo walkthrough

1. Inspect the component manifest and its explicit unsupported capabilities.
2. Compare exact, partial, and unsupported preflight outcomes.
3. Invoke each of the four authored mock scenarios and inspect the structured evidence trace.
4. Open `?view=legacy` to verify the frozen V0.1 seven-step proof.

## Portfolio framing

This project demonstrates AI product boundary judgement, deterministic evaluation design, evidence-oriented architecture, and end-to-end engineering ownership. The key product decision was to prove an inspectable calculation-path core before adding probabilistic parsing or orchestration.

The public product rationale, scope decisions, trade-offs, and next validated experiments are documented in the local [Case Study](docs/CASE_STUDY.md). Broader private planning materials are maintained separately and are not required to review this proof.
