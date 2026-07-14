# Integration with Student Site

## Purpose

Demo PR 1 validates the future Standards Trainer interaction without copying or replacing the live Memorisation Bank. During the sprint, `standard-trainer-demo` is the implementation source. After verified production migration, `student-site` becomes the canonical public product source and this repository remains a tagged prototype and development record.

## 1. Catalog items to Standard Nodes

The adapter consumes a `LegacyMemorisationItem` plus its actual runtime context. It generates the same canonical progress identity used by the frozen Student Site algorithm, then links the item to a Standard Node only when that relationship is explicit.

| Legacy item | Demo PR 1 role | Standard Node |
| --- | --- | --- |
| `as-def-045` | Trainable Dynamic Equilibrium definition | `cambridge-a-level-chem-dynamic-equilibrium-v0.1` |
| `as-fc-001` | Identity and migration fixture only | None in this PR |

The two expected canonical strings are regression oracles, not hard-coded algorithm outputs. The exact frozen helper also preserves the original `level`, `topic`, `packId`, `canonicalSourceId`, and `id` fallbacks; field precedence; empty-round exclusion; and `duplicateKey`. Tests generate each value from runtime context. A mismatch blocks migration and must be investigated.

The identity algorithm itself is pinned alongside the content fixtures: `shhh-hoo/student-site@b514b1c770bac0906632408a7fec8a7da50a4427`, `interactive/9701-memorisation-bank/learning-state-id.mjs`, Git blob `cef4e5e6eaf943241e4a6b2b7fbaa7aded0de44c`. Its fixture creation marker is the same fixed `2026-07-14T00:00:00.000Z`; builds and tests do not generate or rewrite that value.

## 2. Stable legacy IDs

Every attempt retains all three identities:

- raw legacy item ID;
- generated legacy canonical progress content ID;
- Standard Node ID and version, when mapped.

This prevents a new rubric version from severing existing progress identity. The adapter is pure and read-only in Demo PR 1.

## 3. Future progress and review import

The later same-origin beta may read `mb:progress:v1` and `mb:review-list:v1` through a dedicated migration boundary. The first production migration must:

1. take a raw backup before transformation;
2. parse and validate versioned payloads;
3. map canonical content IDs without rewriting them;
4. preview matched and unmatched records;
5. import read-only/merge-first;
6. retain the original keys and backup for rollback.

Demo PR 1 intentionally does none of these writes. Its only storage key is `standard-trainer-demo:attempts:v1`.

## 4. Same-origin requirement

Browser storage is isolated by origin. A standalone demo cannot read data created under `9701.shijia.work`. Real migration must run from a route on that origin; a deployment on another hostname cannot safely or directly import the existing Memorisation Bank state.

## 5. Coexisting beta route

Build the static bundle with:

```bash
npm run build:student-site
```

This sets the base path to:

```text
/interactive/9701-memorisation-bank-next/
```

The beta route can coexist with `/interactive/9701-memorisation-bank/`. Student Site should supply its normal header, theme bootstrap, navigation, and route-level shell; the Trainer bundle supplies the workbench only. No iframe is needed.

## 6. Topic-by-topic fallback

Route only migrated topics into the Trainer. For an unmapped item, missing Standard Node, wrong board, stale cycle, or failed migration check, return to the existing Memorisation Bank rather than relaxing source policy. The intended order is Equilibrium, then later evidence-selected topics.

Each topic switches only after content mapping, stable-ID tests, matcher/eval tests, progress migration tests, user-task tests, and a working legacy fallback all pass.

## 7. Rollback

Keep legacy keys and the legacy route unchanged during beta. A topic flag or route map can send traffic back immediately. Do not delete legacy data during initial import. Retain migration metadata and a backup so an imported view can be rebuilt or abandoned without losing the original state.

## 8. Final route replacement

After topic coverage and progress migration are verified, update Student Site curation so the original Memorisation Bank entry opens the Standards Trainer. Move the old implementation to a legacy route for one release cycle, confirm progress and review behavior, then archive it.

## 9. Recommended sequence and ownership

```text
standalone verified demo
→ Student Site beta route
→ Equilibrium traffic split
→ topic-by-topic migration
→ original route switch
→ legacy fallback period
→ legacy archive
```

After the production source migration, `student-site` is canonical. Do not maintain two live product codebases or use an iframe as long-term architecture.

## Content-authority risk

The frozen legacy answer and the AI-draft operational rubric disagree about whether continuing reactions must be explicit. Exact legacy wording returns `REVIEW / LEGACY_REFERENCE_CONFLICT`. Production migration cannot resolve this by code: it requires named curriculum evidence and qualified review, followed by a versioned rubric decision and regression run.
