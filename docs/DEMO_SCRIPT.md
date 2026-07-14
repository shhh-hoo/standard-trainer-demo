# Five-minute Demo Script

## 0:00–0:40 — Establish the boundary

Open `http://localhost:5173/` and say:

> This is not a general tutor. It trains one job: producing a standard-correct A-Level Chemistry answer. The current operational rubric is an unreviewed AI draft, so the interface reports draft-relative decisions rather than official correctness.

Point out `as-def-045`, `AI draft`, `not expert reviewed`, and rubric version `de-v0.1`.

## 0:40–1:40 — Submit a genuine near-miss

Enter:

> The forward and reverse reactions continue at equal rates while concentrations remain constant.

Submit. Show that the deterministic check identifies `closed_system` as missing and opens the rewrite field. Explain that fluent wording cannot bypass a required element.

## 1:40–2:30 — Complete the forced rewrite

Enter:

> In a closed system, the forward and reverse reactions continue at equal rates while concentrations remain constant with time.

Submit. Show:

- first judgement remains `REWRITE`;
- second judgement is stored separately as internal `PASS`;
- learner-facing wording is “Meets current AI-draft rubric”;
- source/reviewer/authority versions remain visible in the evidence.

## 2:30–3:10 — Inspect evidence and export

Show the attempt archive, persistence status, legacy item ID, and separate first/rewrite results. Export the attempt JSON and point out Standard Node, rubric, deterministic-rule, source, reviewer, and authority fields.

## 3:10–3:50 — Show dangerous wording

Start a new attempt and enter:

> In a closed system, the forward and reverse reactions stop and concentrations remain constant.

Show `DANGEROUS_CLAIM`, the `static_not_dynamic` boundary, and the required rewrite. Explain that dangerous wording takes precedence while missing findings remain inspectable.

## 3:50–4:30 — Show the legacy/draft conflict

Start another attempt and paste the frozen legacy answer:

> in a closed system, the rate of the forward reaction equals the rate of the reverse reaction and the concentrations of reactants and products remain constant

Show `REVIEW / LEGACY_REFERENCE_CONFLICT`. Confirm that no rewrite box appears and the trainer does not call the legacy reference wrong.

## 4:30–5:00 — Close with migration readiness

Explain that:

- `as-def-045` and `as-fc-001` retain raw and generated canonical identities;
- the demo never touches `mb:*` storage;
- real progress import requires a same-origin Student Site beta route;
- the production build supports `/interactive/9701-memorisation-bank-next/` without an iframe.
