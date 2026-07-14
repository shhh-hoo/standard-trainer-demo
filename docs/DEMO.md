# Demo

1. Open the workbench and identify the single curated equilibrium problem.
2. Enter the canonical structured path: `1 mol`, `0.4`, `0.6`, `200 kPa`, `300 kPa`, `p(NO2)^2/p(N2O4)`, and `450 kPa` to `3` significant figures.
3. Submit and inspect the `VALID_PATH` trace and version metadata in the JSON export.
4. Change the first mole fraction to `0.5` and submit again.
5. Confirm that `moleFractionN2O4` is the first invalid step and every later step is `NOT_EVALUATED`.
6. If storage is unavailable, confirm the current-tab-only warning and export the trace before leaving.

The demo contains no LLM call, hint orchestration, generated question, free-text step parser, or ECF claim.
