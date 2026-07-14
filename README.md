# Calculation Path Trainer Demo

Runnable proof of a deterministic chemistry calculation-path engine. The product direction is calculation-path diagnosis: collect structured working, compare it with a curated canonical solution graph, and identify the first invalid step.

This repository is an independent sibling of [10-Day-Challenge](https://github.com/shhh-hoo/10-Day-Challenge). Planning and portfolio evidence live there; runnable product code lives here.

## First PR scope

The implementation contains exactly one curated problem:

`KP_FROM_EQUILIBRIUM_MOLES`

It proves:

- a versioned `ProblemDefinition` and canonical solution graph;
- seven structured student-step inputs with explicit dependency edges;
- deterministic numeric, curated-expression, unit, and significant-figure tools;
- first-invalid-step identification with separate decision and failure codes;
- versioned evidence traces, honest browser persistence, and JSON export;
- a responsive, keyboard-accessible React workbench;
- no LLM call.

## Run locally

```bash
npm install
npm run dev
```

Verification:

```bash
npm run check
npm test
npm run build
```

## Architecture

- `src/domain/` contains pure evaluation, deterministic tools, trace validation, and persistence boundaries.
- `src/fixtures/` contains the single immutable curated problem and its canonical graph.
- `src/App.tsx` translates labeled structured inputs into a submission and renders the resulting trace.
- `tests/` exercises public behavior through the engine, archive, and workbench interfaces.

The engine stops after the first invalid step. Later values are marked `NOT_EVALUATED`; this PR does not claim error-carried-forward correctness.

## Explicit exclusions

This PR does not include natural-language step parsing, arbitrary question parsing, generated questions, LLM or agent orchestration, bounded ECF, learner weakness modelling, hints, or next-problem selection. Those are separate later tickets.

See [Calculation Path Core](docs/CALCULATION_PATH_CORE.md) for the graph and evidence contract, and [Demo](docs/DEMO.md) for a short walkthrough.
