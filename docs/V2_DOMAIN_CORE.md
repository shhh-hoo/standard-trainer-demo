# V2 deterministic diagnostic domain core

The V2 domain core executes the already-authored `2.0.0-draft.2` measurement contract for `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2`. It is a deterministic evidence processor, not a text parser or tutoring UI.

## Public request path

Call `diagnoseNormalizedAttempt(problem, attempt, context)` through `src/domain/v2/index.ts`. The caller supplies the trace ID, submission timestamp, and interpreter metadata. The domain engine does not read clocks, randomness, browser state, network state, fixture labels, or expected diagnoses.

The fixed request path is:

```text
unknown input
→ validate problem
→ reject definitions outside the supported gold authority
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

Invalid user input returns structured validation issues. `validateDiagnosticProblemDefinitionV2` is a generic shape validator; shape-valid does not mean engine-supported. `validateSupportedDiagnosticProblem` restricts diagnosis to `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2` before any Kp-specific logic. Only an unexpected internal invariant is reported as `INTERNAL_INVARIANT_FAILURE`.

## Runtime validation boundary

The public validators are:

- `validateDiagnosticProblemDefinitionV2(value)`
- `validateNormalizedAttempt(value, problem)`
- `validateDiagnosticEvidenceTraceV2(value, problem)`

They fail closed on versions, enums, quantity metadata, ISO timestamps, positive IDs/sequences, cross-references, prior-step ordering, assistance provenance, source/modality unions, visual coordinates, authored recognition confidence intervals, graph/formula references, significant-figure source evidence, interpreter/check metadata, and trace decision consistency. Graph dependency order is determined by `pedagogicalOrder`, not object property order. No schema-validation dependency was added.

`rawTranscription`, `contentRef`, and source display spans remain provenance only. Diagnosis never reparses or branches on them.

## Recognition gate

`aggregateRecognitionGate` evaluates diagnosis-relevant step, region, and artifact evidence before chemistry judgement. `ABSTAINED` has priority over unresolved `REQUIRES_CONFIRMATION`; student-confirmed and policy-compliant auto-accepted evidence pass. A blocked gate produces `RECOGNITION_UNCERTAIN`, no failure code, no pedagogical error, and only ambiguous/not-evaluated stage states.

Recognition uncertainty is never converted into a learner error.

## AST evaluation and strategy alignment

The pure evaluator supports number, variable, binary arithmetic, power, and sum nodes. Variables resolve and compare only through authored fact IDs, prior normalized step IDs, or explicitly supplied reasoning-node IDs. `VariableReference.symbol` is display-only and never participates in semantic equality. Division by zero, forward/unresolved references, unsupported reasoning quantities, and non-finite results are structured failures.

Formula comparison is deliberately limited to authored structural equivalence and the current Kp error classes: inverted relation, wrong species, and wrong stoichiometric power. This is not general symbolic algebra.

Reasoning alignment consumes normalized facts, targets, semantic types, equation targets, formula ASTs, calculations, and declared results. `INFERRED` evidence can support alignment but cannot independently prove a stage. Capability status uses each reasoning node's `independentStageEvidenceKinds`; solution sufficiency remains separate. In particular, `FACT_USE` can satisfy a strategy dependency without proving data extraction.

The compressed analyser returns dependency completeness and formula comparison separately. It identifies both authored mole facts, total-moles subexpressions, mole fractions, total pressure, and each species-specific partial pressure before comparing the outer numerator, denominator, and exponent with `formula-kp-no2-n2o4`. A correct embedded calculation can prove FORMULA without a separate `formulaAst`; squaring N₂O₄ cannot. Direct equilibrium-mole substitution does not match the compressed strategy.

## Deterministic diagnosis and traces

Versioned checks keep fact use, target, strategy, formula, substitution, recomputation, arithmetic, unit, and significant figures as evidence records rather than a single boolean. Numeric tolerance is centralized for the current gold problem. Significant figures use `QuantityValue.raw` and the explicit significant-figure field, never a JavaScript number guess.

`NOT_OBSERVED` is not an error. Downstream effects do not create new errors, while independently verifiable later stages can remain correct. The first `INCORRECT` stage controls the trace failure code and first pedagogical error. A solved result requires an accepted strategy plus formula/substitution satisfaction and independently correct arithmetic, unit, and precision; data extraction and target identification may remain `NOT_OBSERVED`.

Deterministic checks are produced from base evaluations before assistance is overlaid. A tool can therefore remain `PASS` while the learner-facing stage is `SUPPORTED_BY_HINT`. Support applies only when a directly preceding event's stage or revealed reasoning nodes match evidence in that revision; unrelated historical hints do not overwrite later independent work.

All temporal semantics use revision sequence and revision `stepIds`; the physical `attempt.steps` array order is not authoritative. Solved support outcomes use the revision containing the latest result. An unsolved attempt uses the latest revision, so an incomplete revision directly following level-4 support becomes `NOT_SOLVED_AFTER_FULL_SCAFFOLD` even without a result step. The trace contains all immutable policy/problem versions, interpreter metadata, recognition evidence, alignment, deterministic checks, stages, revisions, assistance, support outcome, and caller-supplied submission time. Every engine trace is validated before return.

## V1 structured adapter

`adaptV1SubmissionToV2` supports only `KP_FROM_EQUILIBRIUM_MOLES`. It records the seven-field V0.1 form as a `STRUCTURED`, `GUIDE_ME` attempt with a causally prior level-4 full-scaffold event. Numeric and significant-figure fields become traceable declared-result evidence. Only curated Kp expression forms are mapped; unsupported problems, expressions, or invalid submission timestamps return structured adapter errors. The adapter does not modify or replace the V0.1 engine or UI and does not claim independent strategy mastery.

## Typed-working mock adapter and PR #7 interface

`createTypedWorkingMockAttempt` exposes four named mock scenarios: `COMPRESSED_CORRECT`, `EXPLANATION_ONLY`, `INVERTED_FORMULA`, and `WRONG_DEPENDENCY`. The templates are deterministic fixtures for future PR #7 UI integration. They do not parse arbitrary text, call a model, or make an NLP claim. A future UI may select a scenario, receive a normalized attempt, and pass it with explicit context to the public diagnosis API.

## Trust boundary and exclusions

The gold suite plus adversarial tests prove bounded behavior for the one supported definition; they do not establish curriculum coverage, transfer, or mastery. The live public learner UI remains V0.1.

This core adds no learner UI, OCR, image/digital-ink ingestion UI, camera access, real text parser, LLM/model/provider integration, server endpoint, secrets, hint-delivery UI, retry orchestration, transfer item, question generation, persistence migration, authentication, analytics, general dimensional algebra, general symbolic algebra, or general ECF claim.
