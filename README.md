# Standards-First Learning Trainer Demo

A runnable Cambridge A-Level Chemistry Dynamic Equilibrium Concept Boundary Trainer. This repository proves one migration-ready learning loop:

`first answer → deterministic draft-rubric judgement → missing/dangerous feedback → forced rewrite → second judgement → evidence archive`

It is not a generic chatbot, and it does not replace the live Memorisation Bank in Demo PR 1.

## Run the demo

Requirements: a current Node.js release and npm.

```bash
npm install
npm run dev
```

Open the exact local demo path: [http://localhost:5173/](http://localhost:5173/).

The only trainable item is the frozen Student Site item `as-def-045`. The item `as-fc-001` is retained only in the migration fixture and canonical-ID tests.

## Checks and builds

```bash
npm run check
npm test
npm run build
npm run build:student-site
```

The default build uses `/`. The Student Site compatibility build uses:

```text
/interactive/9701-memorisation-bank-next/
```

The base path is configurable with `VITE_BASE_PATH`.

## Evidence boundary

The active Standard Node is pinned as `AI_DRAFT` and `not_reviewed`. An internal `PASS` is presented to the learner as **“Meets current AI-draft rubric”**. The interface, archive, and JSON export do not describe it as an official, Cambridge-approved, or expert-reviewed answer.

The exact frozen legacy answer is stricter/looser in a material way: it does not state continuing forward and reverse reactions as a separate element. The trainer therefore returns `REVIEW / LEGACY_REFERENCE_CONFLICT`, not an ordinary incorrect judgement.

Attempts use the versioned demo-only storage key:

```text
standard-trainer-demo:attempts:v1
```

No `mb:*` key is read, written, migrated, or deleted by this demo. If browser storage is unavailable or corrupt, the current attempt remains exportable in memory and is visibly labelled current-tab-only.

## Repository relationship

- [`10-Day-Challenge`](https://github.com/shhh-hoo/10-Day-Challenge) owns the PRD, architecture, curriculum/eval specification, sprint status, and portfolio evidence.
- This repository owns runnable product code, fixtures, tests, demo instructions, and build configuration.
- [`student-site`](https://github.com/shhh-hoo/student-site) owns the current public Memorisation Bank, content catalog, public navigation, visual shell, and existing learner progress.

The repositories are independent siblings, not submodules. Demo PR 1 is grounded in `10-Day-Challenge@17272ba51cbd3035182c443d14cb4ee5514b84fd` and frozen Student Site content at `b514b1c770bac0906632408a7fec8a7da50a4427`.

## Architecture

- `src/domain/`: framework-independent judgement, workflow, persistence, identity, and adapter logic.
- `src/fixtures/`: immutable content, rubric, progress, and provenance snapshots.
- `src/App.tsx`: React presentation and interaction orchestration only.
- `tests/`: deterministic, workflow, persistence, migration, and interface regression tests.

Student Site compatibility uses the same `--locked-*`, `--action-*`, and interactive-route token names for the subset needed here. The page deliberately omits the full Student Site header; the same-origin beta route will supply the production shell later.

## Documentation

- [Student Site integration path](docs/INTEGRATION_WITH_STUDENT_SITE.md)
- [Five-minute demo script](docs/DEMO_SCRIPT.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)

## Explicit non-goals

Demo PR 1 does not add live AI/RAG, real authentication, Supabase/RLS, Stripe, billing, a teacher or expert-admin interface, a full AS/A2 catalog, a production review queue, automatic cross-repository synchronization, an iframe, real legacy-storage import, or a live Student Site route switch.
