# Calculation Path Trainer

## Product statement

Calculation Path Trainer is a deterministic chemistry calculation-path diagnosis proof for Cambridge A-Level Chemistry-style structured working. It collects an authored sequence of calculation steps, checks each step against one immutable canonical solution graph, and identifies the first invalid step instead of generating a general answer.

The current release contains exactly one curated problem: `KP_FROM_EQUILIBRIUM_MOLES`. It is a bounded engine proof, not a complete learning platform.

## Live Demo

Deployment will become available after this release PR is merged and GitHub Pages is enabled.

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

The expression checker is a versioned whitelist matcher for the curated Kp problem, not a symbolic algebra system. The solution graph records explicit dependencies, but the current engine evaluates steps in authored canonical order. Trace validation checks shape and internal consistency; it is not a cryptographic integrity proof. Browser storage and exported JSON remain under the learner's control.

## Architecture

```text
src/domain/    Pure engine, deterministic tools, trace validation, persistence boundary
src/fixtures/  Immutable curated problem and canonical solution graph
src/App.tsx    Structured-input workbench and evidence presentation
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

The current suite contains 15 tests and is verified by [GitHub Actions CI](.github/workflows/ci.yml). The calculation-path milestone was merged in [PR #2](https://github.com/shhh-hoo/standard-trainer-demo/pull/2). That PR originally produced squash commit `1881d3e`; after the author-email privacy rewrite, the equivalent current `main` commit is `ae59020`.

## Demo walkthrough

1. Enter the canonical seven-step path shown in [Demo](docs/DEMO.md).
2. Submit it and receive `VALID_PATH` with no failure code.
3. Change the early N₂O₄ mole-fraction value from `0.4` to `0.5`.
4. Submit again and see `moleFractionN2O4` identified as the first invalid step.
5. Confirm every later step is preserved in the trace as `NOT_EVALUATED`.
6. Export the evidence JSON and inspect the problem, graph, engine, and tool versions.

## Portfolio framing

This project demonstrates AI product boundary judgement, deterministic evaluation design, evidence-oriented architecture, and end-to-end engineering ownership. The key product decision was to prove an inspectable calculation-path core before adding probabilistic parsing or orchestration.

Product planning and research live in the independent [10-Day-Challenge](https://github.com/shhh-hoo/10-Day-Challenge) repository. The relevant direction is fixed in [ADR-001 at `d04ca9b`](https://github.com/shhh-hoo/10-Day-Challenge/blob/d04ca9bdbc3317ce9de2987c521ec66736d946d6/docs/decisions/ADR-001-calculation-coach-pivot.md); runnable product code remains in this repository.
