# Calculation Path Core

## Contract

`KP_FROM_EQUILIBRIUM_MOLES@1.0.0` is the only problem in this PR. Its immutable solution graph is also version `1.0.0`.

| Order | Step | Dependencies | Deterministic checks |
| --- | --- | --- | --- |
| 1 | `totalMoles` | none | numeric, unit |
| 2 | `moleFractionN2O4` | `totalMoles` | numeric, dimensionless unit |
| 3 | `moleFractionNO2` | `totalMoles` | numeric, dimensionless unit |
| 4 | `partialPressureN2O4` | `moleFractionN2O4` | numeric, unit |
| 5 | `partialPressureNO2` | `moleFractionNO2` | numeric, unit |
| 6 | `kpExpression` | none | curated expression variants, dimensionless input |
| 7 | `kpResult` | both partial pressures and `kpExpression` | numeric, unit, significant figures |

The expression tool is a versioned whitelist matcher for this curated problem. It is not a symbolic algebra system or an arbitrary expression parser.

## Evaluation

The engine visits the canonical order once. Within a step, checks run in this order:

1. numeric value;
2. curated expression;
3. unit;
4. significant figures.

The first failure becomes the trace-level `failureCode` and `firstInvalidStepId`. Every later step is recorded as `NOT_EVALUATED`. A missing structured step returns `INCOMPLETE_PATH / MISSING_STEP`; another failed tool returns `INVALID_PATH` with its specific code; all valid steps return `VALID_PATH / null`.

Stopping after the first invalid step is a diagnostic policy, not an error-carried-forward judgement. This PR makes no general ECF claim.

## Evidence

Each trace records:

- problem ID, problem version, and problem schema version;
- solution graph and engine versions;
- step dependency edges, submitted structured values, status, and tool versions;
- decision, failure code, and first invalid step;
- submission timestamp and persistence status.

The storage key is `standard-trainer-demo:calculation-path-traces:v1`. Invalid or corrupted stored traces are not exposed to React and are not overwritten. When browser storage is unavailable, traces remain exportable in the current tab and are labeled `MEMORY_ONLY`.

## Later PRs

Agentic orchestration, natural-language student-step parsing, bounded ECF, learner weakness modelling, hints, next-problem selection, arbitrary question parsing, and generated questions are outside this core proof.
