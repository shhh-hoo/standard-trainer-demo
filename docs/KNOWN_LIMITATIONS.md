# Known Limitations

## Content authority

- The Dynamic Equilibrium Standard Node is `AI_DRAFT` and `not_reviewed`.
- It is not evidence of an official Cambridge definition or product accuracy.
- The frozen legacy answer conflicts with the draft rubric on an explicit “reactions continue” element. The demo routes that exact wording to review; only curriculum evidence and qualified review can resolve it.

## Judgement coverage

- Deterministic patterns cover one Dynamic Equilibrium definition fixture and its frozen eval cases.
- They do not provide open-ended semantic equivalence, typo recovery, broad chemistry coverage, or a production false-positive/false-negative claim.
- Ambiguous language needs a later constrained judge, verifier, and human-review path. A model must not replace hard source-policy checks.

## Persistence and migration

- Attempts are browser-local and contain raw learner answers; there is no authentication or permission boundary.
- `MEMORY_ONLY` evidence disappears when the tab closes unless exported.
- Demo PR 1 does not read or import `mb:progress:v1`, `mb:review-list:v1`, or `mb:settings:v1`.
- Cross-origin browser rules prevent the standalone demo from reading `9701.shijia.work` state.
- The legacy adapter is a fixture-backed preview, not production migration logic.

## Product scope

- Only `as-def-045` is trainable. `as-fc-001` exists solely to prove legacy identity preservation.
- There is no review queue, spaced-repetition scheduling, teacher view, expert console, broad catalog, live AI, RAG, authentication, Supabase, Stripe, billing, or deployment automation.
- The standalone page mirrors a subset of Student Site tokens but deliberately does not copy its full header, navigation, or route shell.

## Evidence claims still required

- Qualified chemistry/curriculum review of the Standard Node and eval labels.
- Category-level false-accept and false-reject results on a reviewed frozen set.
- Same-origin migration tests using sanitized legacy progress fixtures.
- Real learner task evidence before claiming a learning outcome.
