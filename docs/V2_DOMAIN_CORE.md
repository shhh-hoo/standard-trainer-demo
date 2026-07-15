# V2 deterministic diagnostic domain core

The V2 domain core executes the already-authored `2.0.0-draft.2` measurement contract for `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2`. It is a deterministic evidence processor, not a text parser or tutoring UI.

## Public request path

Call `diagnoseNormalizedAttempt(problem, attempt, context)` through `src/domain/v2/index.ts`. The caller supplies the trace ID, submission timestamp, and interpreter metadata. The domain engine does not read clocks, randomness, browser state, network state, fixture labels, or expected diagnoses.

The fixed request path is:

```text
unknown input
→ validate problem
→ validate normalized attempt
→ aggregate recognition gate
→ align structured reasoning evidence
→ match an authored strategy
→ run versioned deterministic checks
→ derive eight stage evaluations
→ select the first pedagogical error
→ derive decision and attempt support outcome
→ validate the output trace
```

Invalid user input returns structured validation issues. Only an unexpected internal invariant is reported as `INTERNAL_INVARIANT_FAILURE`.

## Runtime validation boundary

The public validators are:

- `validateDiagnosticProblemDefinitionV2(value)`
- `validateNormalizedAttempt(value, problem)`
- `validateDiagnosticEvidenceTraceV2(value, problem)`

They fail closed on versions, duplicate IDs/sequences, cross-references, prior-step ordering, assistance provenance, source/modality unions, visual coordinates, recognition thresholds, graph/formula references, significant-figure source evidence, and trace decision consistency. No schema-validation dependency was added.

`rawTranscription`, `contentRef`, and source display spans remain provenance only. Diagnosis never reparses or branches on them.

## Recognition gate

`aggregateRecognitionGate` evaluates diagnosis-relevant step, region, and artifact evidence before chemistry judgement. `ABSTAINED` has priority over unresolved `REQUIRES_CONFIRMATION`; student-confirmed and policy-compliant auto-accepted evidence pass. A blocked gate produces `RECOGNITION_UNCERTAIN`, no failure code, no pedagogical error, and only ambiguous/not-evaluated stage states.

Recognition uncertainty is never converted into a learner error.

## AST evaluation and strategy alignment

The pure evaluator supports number, variable, binary arithmetic, power, and sum nodes. Variables resolve only through authored fact IDs, prior normalized step IDs, or explicitly supplied reasoning quantities. Display symbols do not resolve references. Division by zero, forward/unresolved references, unsupported reasoning quantities, and non-finite results are structured failures.

Formula comparison is deliberately limited to authored structural equivalence and the current Kp error classes: inverted relation, wrong species, and wrong stoichiometric power. This is not general symbolic algebra.

Reasoning alignment consumes normalized facts, targets, semantic types, equation targets, formula ASTs, calculations, and declared results. `INFERRED` evidence can support alignment but cannot independently prove a stage. The explicit strategy requires its authored independent steps. The compressed strategy matches only when one calculation AST contains both mole amounts, total-moles dependencies, both mole fractions, both partial pressures, total pressure, the Kp relation, substitution, arithmetic, unit, and precision. Direct equilibrium-mole substitution does not match it.

## Deterministic diagnosis and traces

Versioned checks keep fact use, target, strategy, formula, substitution, recomputation, arithmetic, unit, and significant figures as evidence records rather than a single boolean. Numeric tolerance is centralized for the current gold problem. Significant figures use `QuantityValue.raw` and the explicit significant-figure field, never a JavaScript number guess.

`NOT_OBSERVED` is not an error. Downstream effects do not create new errors, while independently verifiable later stages can remain correct. The first `INCORRECT` stage controls the trace failure code and first pedagogical error.

Attempt support outcomes use only assistance linked to the revision containing the final result. The trace contains all immutable policy/problem versions, interpreter metadata, recognition evidence, alignment, deterministic checks, stages, revisions, assistance, support outcome, and caller-supplied submission time. Every engine trace is validated before return.

## V1 structured adapter

`adaptV1SubmissionToV2` supports only `KP_FROM_EQUILIBRIUM_MOLES`. It records the seven-field V0.1 form as a `STRUCTURED`, `GUIDE_ME` attempt with a causally prior level-4 full-scaffold event. Numeric fields become declared-result evidence. Only curated Kp expression forms are mapped; unsupported problems or expressions return structured adapter errors. The adapter does not modify or replace the V0.1 engine or UI and does not claim independent strategy mastery.

## Typed-working mock adapter and PR #7 interface

`createTypedWorkingMockAttempt` exposes four named mock scenarios: `COMPRESSED_CORRECT`, `EXPLANATION_ONLY`, `INVERTED_FORMULA`, and `WRONG_DEPENDENCY`. The templates are deterministic fixtures for future PR #7 UI integration. They do not parse arbitrary text, call a model, or make an NLP claim. A future UI may select a scenario, receive a normalized attempt, and pass it with explicit context to the public diagnosis API.

## Trust boundary and exclusions

The gold suite proves exact behavior for 16 authored fixtures; it does not establish curriculum coverage, transfer, or mastery. The live public learner UI remains V0.1.

This core adds no learner UI, OCR, image/digital-ink ingestion UI, camera access, real text parser, LLM/model/provider integration, server endpoint, secrets, hint-delivery UI, retry orchestration, transfer item, question generation, persistence migration, authentication, analytics, general dimensional algebra, general symbolic algebra, or general ECF claim.
