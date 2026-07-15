# Demo

1. Open the default component inspector and read the manifest for the single supported equilibrium problem.
2. Select **Exact match**, **Partial match**, and **No match**. Confirm the corresponding `EXACT_MATCH`, `PARTIAL_MATCH`, and `UNSUPPORTED` coverage decisions and recommended actions.
3. Select each authored mock scenario and invoke the component. Confirm that the result envelope reports `COMPLETED`, keeps decision and failure code separate, and records `TYPED_WORKING_MOCK` provenance.
4. Expand the evidence trace and inspect problem, graph, engine, tool, interpreter, and support-causality fields.
5. Open `?view=legacy` for the frozen learner proof. Enter `1 mol`, `0.4`, `0.6`, `200 kPa`, `300 kPa`, `p(NO2)^2/p(N2O4)`, and `450 kPa` to `3` significant figures.
6. Submit and inspect `VALID_PATH`; then change the first mole fraction to `0.5` and confirm that later steps remain `NOT_EVALUATED` after the first invalid step.

The demo contains no Learning Foundry shell, registry, model call, OCR, hint orchestration, generated question, free-text parser, or ECF claim.
