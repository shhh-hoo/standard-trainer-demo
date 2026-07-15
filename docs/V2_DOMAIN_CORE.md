# V2 deterministic diagnostic domain core

The V2 domain core executes the already-authored `2.0.0-draft.2` measurement contract used by the migrated Kp component. It remains a deterministic evidence processor, not a text parser or tutoring UI. The Foundry-published component runtime is a separate consumer boundary in `src/foundry-runtime`.

## Public request path

Call `diagnoseNormalizedAttempt(problem, attempt, context)` through `src/domain/v2/index.ts`. The caller supplies the trace ID, submission timestamp, and interpreter metadata. The domain engine does not read clocks, randomness, browser state, network state, fixture labels, or expected diagnoses.

The fixed request path is:

```text
unknown input
→ validate problem
→ validate bounded schema, graph, formula, strategy and hint references
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

Invalid input returns structured validation issues. `validateDiagnosticProblemDefinitionV2` checks shape, while `validateSupportedDiagnosticProblem` now checks the bounded structural and internal-reference constraints required by this Kp engine. It no longer treats one serialized fixture as permanent component authority. Published identity, immutability, content hash, runtime capability, and target-adapter selection are enforced by the Foundry consumer boundary before its components reach learner diagnosis. Only an unexpected internal invariant is reported as `INTERNAL_INVARIANT_FAILURE`.

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

Explicit equations have a separate bounded semantic authority for total moles, both mole fractions, both partial pressures, and the final Kp calculation. Prior-step references resolve through their authored reasoning-node targets; display symbols and text are ignored. ADD and MULTIPLY operands may commute, but numerator, denominator, exponent, species, and upstream dependency identities may not. Only semantically valid equations enter strategy alignment. Arithmetic recomputation runs afterward, so a wrong expression evaluated consistently is a substitution/dependency error rather than an arithmetic error.

## Deterministic diagnosis and traces

Versioned checks keep fact use, target, strategy, formula, substitution, recomputation, arithmetic, unit, and significant figures as evidence records rather than a single boolean. Numeric tolerance is centralized for the current gold problem. Significant figures use `QuantityValue.raw` and the explicit significant-figure field, never a JavaScript number guess.

`NOT_OBSERVED` is not an error. Downstream effects do not create new errors, while independently verifiable later stages can remain correct. The first `INCORRECT` stage controls the trace failure code and first pedagogical error. A solved result requires an accepted strategy plus formula/substitution satisfaction and independently correct arithmetic, unit, and precision; data extraction and target identification may remain `NOT_OBSERVED`.

Deterministic checks are produced from base evaluations before assistance is overlaid. A tool can therefore remain `PASS` while the learner-facing stage is `SUPPORTED_BY_HINT`. One `resolveDecisionRevision` rule selects the adopted result revision for solved attempts and the latest revision for unsolved attempts. Both the learner-facing overlay and attempt support outcome use only that revision's directly linked events; unrelated historical hints cannot overwrite later independent work.

All temporal semantics use revision sequence and revision `stepIds`; the physical `attempt.steps` array order is not authoritative. An incomplete latest revision directly following level-4 support becomes `NOT_SOLVED_AFTER_FULL_SCAFFOLD` even without a result step. Trace validation checks support/outcome causality, required solved stages, the internally selected accepted strategy, and the absence of authored equation semantic failures in a matched/solved trace. The trace schema is unchanged; engine-only facts are supplied as validation context. Every engine trace is validated before return.

## V1 structured adapter

`adaptV1SubmissionToV2` supports only `KP_FROM_EQUILIBRIUM_MOLES`. It records the seven-field V0.1 form as a `STRUCTURED`, `GUIDE_ME` attempt with a causally prior level-4 full-scaffold event. Numeric and significant-figure fields become traceable declared-result evidence. Only curated Kp expression forms are mapped; unsupported problems, expressions, or invalid submission timestamps return structured adapter errors. The adapter does not modify or replace the V0.1 engine or UI and does not claim independent strategy mastery.

## Typed-working mock adapter and PR #7 interface

`createTypedWorkingMockAttempt` exposes four named mock scenarios: `COMPRESSED_CORRECT`, `EXPLANATION_ONLY`, `INVERTED_FORMULA`, and `WRONG_DEPENDENCY`. The templates are deterministic fixtures for future PR #7 UI integration. They do not parse arbitrary text, call a model, or make an NLP claim. A future UI may select a scenario, receive a normalized attempt, and pass it with explicit context to the public diagnosis API.

## Trust boundary and exclusions

The gold suite plus adversarial tests preserve the legacy V2 Kp regression; they do not establish broad curriculum coverage, transfer, or mastery. The learner UI separately exposes two immutable Foundry-published components through bounded target adapters; the simplified published Kp component proves happy-path parity only.

This core adds no learner UI, OCR, image/digital-ink ingestion UI, camera access, real text parser, LLM/model/provider integration, server endpoint, secrets, hint-delivery UI, retry orchestration, transfer item, question generation, persistence migration, authentication, analytics, general dimensional algebra, general symbolic algebra, or general ECF claim.
