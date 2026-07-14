# V2 Unified Multimodal + Guided Trainer Measurement Contract

Status: `draft.1`, proposed by PR #5

Contract version: `2.0.0-draft.1`

Gold problem: `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.1`

## 1. Decision

Calculation Path Trainer V2 keeps the V0.1 deterministic checking assets but replaces the fixed seven-field learner contract with a modality-neutral evidence contract. Every learner artifact is interpreted into one `NormalizedAttempt`; graph alignment, deterministic checks, diagnosis, hint policy, and evidence tracing operate only on that normalized form.

V0.1 remains a frozen, runnable baseline. Its seven-step form becomes a future `Guide me` level-4 full scaffold; it is not the default V2 learner experience.

This contract is for Cambridge A-Level Chemistry calculation-path diagnosis. It does not define a generic chatbot, general chemistry marker, or conversational tutor.

## 2. Scope and non-goals

PR #5 defines:

- the two learner modes;
- the unified attempt schema;
- a dependency graph that accepts compressed or explicit working;
- diagnosis decisions, stage statuses, and failure codes;
- recognition uncertainty and abstention policy;
- help provenance, the four-level hint ladder, and mastery outcomes;
- evidence trace V2;
- an evaluation plan;
- one Kp gold problem and seven normalized-attempt fixtures.

PR #5 does not implement:

- learner UI changes;
- image upload, digital ink capture, OCR, or a provider API;
- runtime schema validation;
- text or multimodal adapters;
- graph alignment or the V2 diagnosis engine;
- a model gateway or model calls;
- hint delivery, retry, transfer items, or learner mastery persistence;
- agent orchestration, arbitrary parsing, generated questions, or general ECF.

Those boundaries preserve a reviewable measurement contract before probabilistic interpretation is introduced.

## 3. Learner modes

### 3.1 Try it yourself

The learner sees only the original problem statement. The product does not reveal curated givens, the seven-step path, step instructions, intermediate answer fields, or a preferred strategy.

The answer may be handwriting images, digital ink, typed working, an explanation, structured input, or a mixture. “Explanation” is an answer artifact, not a requirement for a chat interface.

The pipeline contract is:

```text
raw artifacts
→ interpretation candidates
→ normalized steps and recognition evidence
→ local confirmation where required
→ reasoning-graph alignment
→ deterministic checks
→ diagnosis policy
→ evidence trace
```

### 3.2 Guide me

The learner still starts from the original problem. Stages are exposed progressively:

1. What is the question asking?
2. Which information matters?
3. What should you calculate first?
4. Write the relationship or formula.
5. Show your substitution.
6. Complete the calculation.
7. Check units and precision.

The same modalities and `NormalizedAttempt` contract apply. A hint is released only after a learner request or an authored failure policy. Every release produces an `AssistanceEvent`. The fixed V0.1 form is level 4, not a separate marking system.

## 4. Unified attempt contract

The normative TypeScript schema is [`src/domain/v2/types.ts`](../src/domain/v2/types.ts). It is compile-time only in PR #5; runtime validation belongs to PR #6.

`NormalizedAttempt` contains:

- immutable contract, problem, and attempt identity;
- learner mode and overall modality;
- one or more source artifacts, allowing mixed modality;
- facts actually used, not facts the interpreter assumes the learner noticed;
- the learner's target interpretation when observed;
- ordered normalized steps with source regions or text spans;
- optional expression ASTs, variable dependencies, values, units, and precision;
- final answer when present;
- recognition issues and confirmation state;
- assistance events.

`modality: MIXED` is used when step sources come from more than one input modality. Every step still names its own source modality and artifact.

The schema separates raw transcription from semantics. A model or adapter may propose `semanticType`, `concept`, `expressionAst`, and variable mappings, but those proposals are evidence for later deterministic evaluation, not correctness decisions.

### 4.1 Source evidence

An image-derived step names its artifact, page, normalized bounding box, and transcription. A text-derived step names its artifact and text span. A diagnosis must be traceable back to one or more source regions or spans.

Bounding boxes use a normalized `0..1` coordinate space so the evidence remains meaningful across display sizes. A future image implementation must retain the original artifact or a stable content reference; the box alone is not sufficient evidence.

### 4.2 Recognition state

Each step records confidence, candidates, whether the student confirmed it, and one of:

- `CONFIRMED` — the learner explicitly selected or corrected the transcription;
- `ABOVE_AUTHORED_THRESHOLD` — no confirmation is required under the problem policy;
- `REQUIRES_CONFIRMATION` — local confirmation is required before subject diagnosis;
- `ABSTAINED` — the content cannot safely be interpreted.

Confidence is not correctness probability. It is a routing signal governed by the authored recognition policy.

### 4.3 Expression boundary

`ExpressionAst` is a transport contract for numbers, variables, binary operations, and an authored `SUM` function. PR #5 does not define an arbitrary expression parser or symbolic equivalence engine. Later adapters may only emit AST candidates that pass runtime schema validation; deterministic tools remain the authority for accepted chemistry relationships and values.

## 5. Reasoning graph contract

The V2 graph represents required reasoning dependencies, not required UI fields. A node can be satisfied by an explicit step, embedded expression, declared result, observed fact use, or target statement as authored for that node.

For the gold Kp problem, the required chain is:

```text
select relevant data ─┐
                     ├→ choose partial-pressure strategy ─┐
identify Kp target ──┘                                    │
identify Kp target → construct Kp expression ─────────────┤
                                                          ↓
                                                 substitute values
                                                          ↓
                                                  calculate result
                                                     ↙          ↘
                                              report unit   report precision
```

The optional explicit nodes are:

- total moles;
- mole fraction of N₂O₄;
- mole fraction of NO₂;
- partial pressure of N₂O₄;
- partial pressure of NO₂.

Optional means the learner is not required to write a separate line. The reasoning evidence must still exist inside the accepted strategy. One compressed expression may align to strategy, formula, substitution, arithmetic, unit, and precision nodes simultaneously.

### 5.1 Accepted strategies for the gold problem

Two strategies are authored:

1. `EXPLICIT_PARTIAL_PRESSURES` — calculate total moles, mole fractions, and both partial pressures before substituting into Kp.
2. `COMPRESSED_DIRECT_SUBSTITUTION` — embed the same partial-pressure dependencies in one Kp expression.

Both use equilibrium amounts to obtain partial pressures and use `Kp = p(NO₂)² / p(N₂O₄)`. Directly substituting equilibrium mole amounts into the pressure expression is not a third accepted strategy; it is `WRONG_DEPENDENCY_USED`.

Adding another valid chemistry method requires a new immutable problem/graph version and gold fixtures. It must not be silently inferred at runtime.

### 5.2 Data-selection observability

Fact use and data-selection mastery are distinct. If a learner uses `0.400`, `0.600`, and `500` correctly but never explicitly identifies which data matter, the system can record those `factsUsed`; it cannot claim the learner demonstrated data extraction. The `DATA_EXTRACTION` stage is therefore `NOT_OBSERVED`.

Explicitly selecting the required facts and excluding the vessel volume can support `CORRECT`. Explicitly selecting the volume as necessary can support `IRRELEVANT_DATA_USED`. Absence of a selection statement is not an error by itself and does not prevent an otherwise valid solution from being `SOLVED`.

## 6. Diagnosis contract

Decisions, failure codes, and stage statuses are separate fields.

### 6.1 Trace-level decisions

| Decision | Meaning |
| --- | --- |
| `SOLVED` | Sufficient evidence supports a correct result, whether independent or assisted. |
| `STUDENT_ERROR` | A confirmed, pedagogically meaningful learner error was found. |
| `INCOMPLETE_EVIDENCE` | Observed work is valid so far but does not establish a completed solution. |
| `RECOGNITION_UNCERTAIN` | Recognition is not safe enough for subject diagnosis. |
| `NOT_SOLVED` | A guided attempt remains unsolved after the authored level-4 scaffold. |

`failureCode` is null for `SOLVED`, `INCOMPLETE_EVIDENCE`, and `RECOGNITION_UNCERTAIN`. Recognition uncertainty is a workflow decision, never a student failure code.

### 6.2 Cognitive stages and failure codes

| Stage | Failure codes |
| --- | --- |
| `DATA_EXTRACTION` | `RELEVANT_DATA_OMITTED`, `IRRELEVANT_DATA_USED` |
| `TARGET_IDENTIFICATION` | `TARGET_MISIDENTIFIED` |
| `STRATEGY` | `WRONG_METHOD`, `MISSING_REASONING_LINK`, `UNSUPPORTED_ASSUMPTION` |
| `FORMULA` | `WRONG_FORMULA`, `WRONG_SPECIES`, `WRONG_STOICHIOMETRIC_POWER`, `INVERTED_RELATION` |
| `SUBSTITUTION` | `WRONG_VALUE_SUBSTITUTED`, `WRONG_DEPENDENCY_USED` |
| `ARITHMETIC` | `ARITHMETIC_ERROR` |
| `UNIT` | `UNIT_ERROR` |
| `PRECISION` | `SIGNIFICANT_FIGURES_ERROR` |

### 6.3 Stage statuses

| Status | Use |
| --- | --- |
| `CORRECT` | Confirmed evidence independently satisfies the authored stage contract. |
| `INCORRECT` | Confirmed evidence establishes a learner error at this stage. |
| `AMBIGUOUS_RECOGNITION` | This stage depends on unresolved recognition. |
| `NOT_OBSERVED` | The learner did not expose enough evidence to judge this capability. |
| `DOWNSTREAM_AFFECTED` | Evidence is present, but its result inherits an earlier error and no independent error is asserted. |
| `NOT_EVALUATED` | The stage cannot be safely evaluated under the gating or dependency policy. |
| `SUPPORTED_BY_HINT` | The stage is satisfied only after an assistance event revealed its required content. |

### 6.4 First pedagogically meaningful error

After the recognition gate passes, the engine evaluates independently observable stages in authored pedagogical order. The first `INCORRECT` stage with a specific failure code is `firstPedagogicalError` and supplies the trace-level `failureCode`.

The rule is evidence-based rather than “first array mismatch”:

1. `NOT_OBSERVED` is not an error.
2. A missing optional explicit node is not an error when its dependency is embedded elsewhere.
3. `DOWNSTREAM_AFFECTED` never replaces the first error and never invents a second error.
4. `NOT_EVALUATED` is used when dependencies are absent or recognition is gated.
5. A later stage may still be `CORRECT` if it is independently verifiable. Correct precision, for example, can remain observed even when the formula is inverted.
6. The engine makes no general error-carried-forward or mark-award claim.

Example: correct partial pressures followed by an inverted Kp expression yields `FORMULA / INVERTED_RELATION`. Its substitution, arithmetic, and unit may be `DOWNSTREAM_AFFECTED`; the learner is not separately accused of arithmetic error.

## 7. Recognition uncertainty policy

The gold policy authors two thresholds:

- confidence `>= 0.95`: accept the transcription without learner confirmation;
- confidence `>= 0.70` and `< 0.95`: show the local region and candidates, then require confirmation;
- confidence `< 0.70`: abstain and request a clearer local artifact or manual transcription.

These values are gold-problem policy, not universal model constants. Changing them requires a recognition-policy version change and evaluation evidence.

Before deterministic diagnosis, every diagnosis-relevant region must be `CONFIRMED` or `ABOVE_AUTHORED_THRESHOLD`. Otherwise:

- the trace decision is `RECOGNITION_UNCERTAIN`;
- affected stages are `AMBIGUOUS_RECOGNITION` or `NOT_EVALUATED`;
- `failureCode` and `firstPedagogicalError` are null;
- the product must not render a student-incorrect claim.

Confirmation is local. If only `0.400` is ambiguous, the learner confirms that region rather than retranscribing the whole page. The selected candidate and source region are retained in the trace.

Interpretation components may transcribe content, segment steps, propose ASTs, map variables, and attach confidence/evidence regions. They must not decide correctness, failure codes, first pedagogical error, marks, or mastery.

## 8. Assistance provenance and hint ladder

Each `AssistanceEvent` records stage, level, authored hint ID, trigger (`LEARNER_REQUEST` or `CONSECUTIVE_FAILURES`), revealed concepts, and timestamp. Events are append-only evidence; changing learner mode or retrying does not erase them. The gold policy permits automatic escalation only after two consecutive failures at the same stage; otherwise help requires a learner request.

| Level | Meaning | Mastery impact when solved |
| --- | --- | --- |
| 1 | Metacognitive prompt; reveals no chemistry relationship | `SOLVED_AFTER_METACOGNITIVE_PROMPT` |
| 2 | Strategy hint; reveals the next method class | `SOLVED_AFTER_STRATEGY_HINT` |
| 3 | Formula hint; reveals an authored relationship | `SOLVED_AFTER_FORMULA_HINT` |
| 4 | Full scaffold; exposes the V0.1-style structured path | `SOLVED_USING_FULL_SCAFFOLD` |

No assistance events yields `SOLVED_INDEPENDENTLY`. Failure after level 4 yields `NOT_SOLVED_AFTER_FULL_SCAFFOLD`. When an attempt is incomplete or recognition-gated, mastery is `INSUFFICIENT_EVIDENCE`.

If several hints were used, the mastery outcome reflects the highest assistance level that materially supported the successful solution. A stage revealed by a hint is `SUPPORTED_BY_HINT`, not `CORRECT` as independent evidence.

A later transfer attempt must have its own attempt and trace. PR #9 will author the transfer problem and assistance-reduction policy; PR #5 only fixes the evidence fields needed to distinguish training performance from transfer mastery.

## 9. Evidence trace V2

The normative trace shape is `DiagnosticEvidenceTraceV2` in the TypeScript contract. A trace contains:

- immutable problem, graph, diagnosis, recognition, and hint-policy versions;
- interpreter kind and adapter, model, or prompt versions when applicable;
- the recognition gate decision, issues, candidates, confirmations, and source regions;
- normalized-step-to-reasoning-node alignment with basis and confidence;
- deterministic check evidence with tool version and failure code;
- stage status, trace decision, first pedagogical error, and failure code;
- assistance events and mastery outcome;
- attempt identity and submission time.

Trace versions derive from immutable authored definitions. UI state, learner input, confidence, timestamps, and assistance events are evidence payloads and must not alter version identifiers.

The trace preserves decisions and failure codes separately. `RECOGNITION_UNCERTAIN` is a decision with no chemistry failure code. `SUPPORTED_BY_HINT` is stage evidence and does not rewrite a deterministic tool result.

PR #5 defines the shape only. Runtime validation, persistence migration, and JSON export implementation belong to later accepted tickets.

## 10. Gold problem and artifacts

The normative gold definition is [`src/fixtures/v2/kpGoldProblem.ts`](../src/fixtures/v2/kpGoldProblem.ts). Gold attempts and expected outcomes are in [`src/fixtures/v2/kpNormalizedAttempts.ts`](../src/fixtures/v2/kpNormalizedAttempts.ts).

| Fixture | Contract behavior |
| --- | --- |
| `HANDWRITING_COMPLETE_CORRECT` | Concrete normalized output for a complete page with source boxes and an independent solution. |
| `TYPED_COMPRESSED_CORRECT` | One line aligns to multiple graph nodes; data extraction remains `NOT_OBSERVED`. |
| `EXPLANATION_STRATEGY_ONLY` | Target, strategy, and formula can be judged; later stages are `NOT_OBSERVED`. |
| `TYPED_INVERTED_FORMULA` | First pedagogical error is `FORMULA / INVERTED_RELATION`; downstream work is affected. |
| `TYPED_WRONG_SUBSTITUTION_DEPENDENCY` | Correct formula followed by use of amounts instead of partial pressures. |
| `HANDWRITING_RECOGNITION_UNCERTAIN` | Open `0.400 / 0.460` ambiguity forces abstention, not a student error. |
| `GUIDED_SOLVED_AFTER_FORMULA_HINT` | Mixed-modality success retains level-3 assistance provenance. |

The fixtures are normalized gold artifacts, not claims that an interpreter can already produce them.

## 11. Evaluation plan

PR #6 and later adapters must be evaluated against a frozen, human-reviewed gold corpus. Each artifact requires raw source, normalized attempt, graph alignment, stage statuses, first diagnosis, decision, and mastery outcome.

### 11.1 Contract/core gates

- 100% runtime-schema acceptance for valid gold fixtures.
- 100% runtime-schema rejection for deliberately malformed contract fixtures added in PR #6.
- 100% exact match for gold decision, first pedagogical error, and failure code.
- 100% exact match for stage statuses in this bounded Kp corpus.
- 100% exact match for assistance events and mastery outcome.
- zero required explicit-node errors when an accepted compressed expression contains equivalent evidence.

### 11.2 Recognition safety gates

- zero `STUDENT_ERROR` decisions while a diagnosis-relevant recognition issue is open.
- 100% of below-threshold regions retain a local evidence reference and candidates or an abstention reason.
- 100% of student corrections supersede the model candidate before deterministic checking.
- report recognition transcription accuracy separately from diagnosis accuracy.

### 11.3 Interpretation/alignment reporting

For typed and later multimodal adapters, report:

- step-boundary precision and recall;
- semantic-type accuracy;
- concept-mapping accuracy;
- AST exact match or authored structural equivalence;
- graph-node alignment precision and recall;
- calibration by confidence bucket;
- abstention rate and false-student-error rate.

No aggregate score may hide a false student-error caused by recognition. That safety error is reported separately and blocks release.

### 11.4 Gold expansion rules

A gold artifact must be independently reviewed by a chemistry subject-matter reviewer and a contract reviewer. Disagreement is resolved in the authored problem definition or diagnosis policy before the artifact is accepted. New valid strategies, thresholds, or failure semantics require version changes rather than fixture-only exceptions.

The initial corpus is deliberately small and proves contract behavior, not model quality or curriculum coverage. PR #8 must add real image artifacts before making multimodal interpretation claims. PR #9 must add an authored isomorphic transfer item before making mastery claims.

## 12. Acceptance questions

1. **What is the normalized output for a complete handwriting answer?**

   `HANDWRITING_COMPLETE_CORRECT` provides artifact identity, page/region sources, transcriptions, semantic types, concepts, dependencies, results, units, confidence, confirmation state, facts used, target, final answer, and expected diagnosis.

2. **What can be judged when the learner only describes a strategy?**

   Explicit target, strategy, and formula evidence can be judged. Data selection, substitution, arithmetic, unit, and precision remain `NOT_OBSERVED` unless the explanation actually exposes them. The decision is `INCOMPLETE_EVIDENCE`, not incorrect.

3. **How does a compressed expression align?**

   One normalized step may align to multiple required and optional graph nodes through embedded expression and declared-result evidence. Separate total-moles, mole-fraction, and partial-pressure lines are not required.

4. **When does OCR require confirmation or abstain?**

   Gold thresholds are `>=0.95` auto-accept, `0.70..0.95` local confirmation, and `<0.70` abstention. Any open diagnosis-relevant issue blocks chemistry diagnosis.

5. **How is assisted success distinguished?**

   Append-only assistance events record stage, level, hint, concepts, and time. Mastery uses the highest material help level, and revealed stages are `SUPPORTED_BY_HINT`.

6. **Which correct strategies are allowed?**

   The gold problem authors explicit partial-pressure working and a compressed direct-substitution form. New strategies require a versioned definition and gold evidence.

7. **How is the first pedagogical error defined?**

   It is the earliest independently observable `INCORRECT` cognitive stage after recognition gating, with a specific failure code—not the first missing field or numeric array mismatch.

8. **How are downstream stages classified?**

   Use `DOWNSTREAM_AFFECTED` when present evidence inherits an earlier error, `NOT_EVALUATED` when dependencies or recognition prevent judgement, and `CORRECT` only when later evidence is independently verifiable.

9. **What may a model do?**

   It may transcribe, segment, propose ASTs, map variables, and emit confidence and evidence regions. It may not decide correctness, failure codes, first error, marks, hints, or mastery.

10. **What gold evidence is required?**

    Raw artifacts, reviewed normalized attempts, alignment labels, recognition candidates/confirmations, deterministic outcomes, stage statuses, first diagnosis, assistance provenance, and mastery outcome. Multimodal and transfer claims require later real-image and isomorphic-transfer corpora.

## 13. Planned delivery sequence

- PR #5: this measurement contract and gold corpus.
- PR #6: runtime validation, V1/structured and typed-working mock adapters, alignment, deterministic V2 diagnosis, and gold tests.
- PR #7: `Try it yourself` and `Guide me` learner UI using mock interpretation.
- PR #8: bounded server-side multimodal interpreter for this Kp problem, with local confirmation and no model grading.
- PR #9: targeted hints, retry, assistance reduction, one authored transfer item, and mastery evidence.

No later PR should bypass the recognition gate or duplicate subject judgement by modality.
