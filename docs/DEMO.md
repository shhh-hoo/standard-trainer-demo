# Demo

1. Open Standard Trainer and show the Foundry registry with Kp and Stoichiometric product mass.
2. Select **Kp from equilibrium amounts**. Point out migrated provenance, component version, hash, and immutable contract copy.
3. Submit the default complete evidence to receive `SOLVED` with the component and runtime versions in the trace.
4. Select **Stoichiometric product mass**. Submit the canonical `1` Mg:MgO ratio, `8.00 g`, and `3` significant figures.
5. Change the ratio to `0.5`. The first pedagogical error becomes `FORMULA / WRONG_STOICHIOMETRIC_RATIO`.
6. Restore the ratio and try an arithmetic working value of `7.9`, unit `kg`, or `2` significant figures to see each typed diagnosis.
7. Omit the first reasoning link to show `MISSING_REASONING_LINK` without pretending incomplete evidence is solved.
8. Open `?view=inspector` to inspect the previous V2 capability preflight and developer fixture envelope.

The demo contains no LLM call, arbitrary parser, generated-content ingestion, general Chemistry support, or ECF claim.

## Learning Foundry guided scene

With `npm run demo:local` running from the sibling Learning Foundry repository, open Standard Trainer through Demo Shell scene 6. The runtime loads validated `stoichiometric-product-mass@1.1.0` from the local registry. Enter ratio `0.5` and diagnose: the deterministic result remains `FORMULA / WRONG_STOICHIOMETRIC_RATIO`, while Recommended support displays the strengthened 2:2 → 1:1 hint. `?embedded=1` emits runtime selection and diagnosis events; `?view=inspector` retains the legacy engineering surface.
