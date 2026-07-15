# V2 Unified Multimodal + Guided Trainer Measurement Contract

Status: `draft.2`, proposed by PR #5

Contract version: `2.0.0-draft.2`

Gold problem: `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2`

## 1. Decision

Calculation Path Trainer V2 keeps the frozen V0.1 deterministic checking assets but replaces the fixed seven-field learner contract with a modality-neutral evidence contract. Every learner artifact is interpreted into one `NormalizedAttempt`; recognition gating, graph alignment, deterministic checks, diagnosis, and support policy operate only on normalized structure.

V0.1 remains the runnable baseline. Its seven-step form may later appear only as `Guide me` level-4 full scaffold. It is not the default V2 experience.

This contract is for Cambridge A-Level Chemistry calculation-path diagnosis. It is not a generic chatbot, a general chemistry marker, or evidence that one solved item establishes mastery.

## 2. Scope and non-goals

PR #5 defines:

- `Try it yourself` and `Guide me`;
- a unified multimodal attempt schema;
- formula evidence and independently recomputable calculation evidence;
- strategy-specific reasoning evidence requirements;
- solution sufficiency versus independent capability observation;
- recognition evidence, issue scope, and attempt-level gating;
- diagnosis decisions, stage statuses, and failure codes;
- ordered revisions and assistance causality;
- single-attempt support outcomes;
- evidence trace V2;
- one Kp gold problem and sixteen normalized-attempt fixtures;
- fifteen V2 contract-integrity tests.

PR #5 does not implement:

- learner UI changes;
- runtime schema validation;
- structured, typed, or multimodal adapters;
- graph alignment or a V2 diagnosis engine;
- image upload, digital ink capture, OCR, or provider APIs;
- a server endpoint, model gateway, or model call;
- hint delivery, retry orchestration, or a transfer item;
- question generation, arbitrary parsing, agent orchestration, or general ECF.

The contract is intentionally fixed before probabilistic interpretation is introduced.

## 3. Learner modes

### 3.1 Try it yourself

The learner sees the original problem only. Curated givens, a preferred path, instructions, and intermediate fields are not revealed. Work may be handwriting, digital ink, typed calculation, explanation, structured input, or a mixture.

The pipeline contract is:

```text
raw artifacts
→ interpretation candidates
→ normalized steps and equations
→ recognition gate
→ reasoning-graph alignment
→ deterministic recomputation
→ diagnosis policy
→ evidence trace
```

An explanation is an answer artifact, not a requirement for a chat interface.

### 3.2 Guide me

The learner still begins from the original problem. Stages are released progressively:

1. What is the question asking?
2. Which information matters?
3. What should you calculate first?
4. Write the relationship or formula.
5. Show your substitution.
6. Complete the calculation.
7. Check units and precision.

The same `NormalizedAttempt` schema applies. A hint is released only after a learner request or the authored consecutive-failure policy. Each hint and each learner submission is globally ordered so the trace can establish whether work occurred before or after assistance.

## 4. Unified attempt contract

The normative TypeScript schema is [`src/domain/v2/types.ts`](../src/domain/v2/types.ts). It is a compile-time contract in PR #5; runtime validation belongs to PR #6.

`NormalizedAttempt` contains:

- immutable contract and problem identity;
- learner mode and overall modality;
- source artifacts;
- facts actually used;
- target interpretation when observed;
- normalized steps;
- ordered revisions;
- final answer when present;
- recognition issues;
- assistance events.

`modality: MIXED` is used when more than one input modality contributes. Each step retains one precise source.

### 4.1 Modality-aware source evidence

`StepSource` is a discriminated union:

- handwriting and digital ink require `artifactId`, page, and normalized bounding box;
- typed working, explanation, and structured input require `artifactId` and text span.

This prevents obviously invalid source combinations at compile time. Every source artifact ID and modality must resolve inside the attempt. Bounding boxes use normalized `0..1` coordinates.

Recognition issues may be scoped before or after step segmentation:

- `ARTIFACT` for an unreadable page or invalid crop;
- `REGION` for a local visual ambiguity before a reliable step boundary exists;
- `STEP` for an issue attached to an already normalized step.

`stepId` is required only for `STEP` scope.

### 4.2 Formula evidence versus calculation evidence

Formula knowledge and actual working are separate fields:

```ts
interface NormalizedStep {
  formulaAst?: ExpressionAst;
  calculation?: EquationEvidence;
}

interface EquationEvidence {
  target: VariableReference;
  expression: ExpressionAst;
  declaredResult?: QuantityValue;
}
```

`formulaAst` expresses a chemistry relationship such as:

```text
Kp = p(NO₂)² / p(N₂O₄)
```

`calculation.expression` expresses the calculation the learner actually performed. For compressed working it contains the full dependency structure:

```text
[(n(NO₂) / (n(NO₂) + n(N₂O₄)) × Ptotal)²]
──────────────────────────────────────────────────────────
 [n(N₂O₄) / (n(NO₂) + n(N₂O₄)) × Ptotal]
```

`declaredResult` records the learner's reported value, unit, significant figures, and source-facing raw form. This permits deterministic tools to:

1. resolve every authored fact or prior step;
2. recompute the expression;
3. compare recomputed and declared values;
4. check unit and precision independently.

Deterministic diagnosis must not parse `rawTranscription`, trust an interpreter correctness label, or infer working from the final answer. Raw transcription remains provenance only.

### 4.3 Stable variable references

Every variable AST node is one of:

- `AUTHORED_FACT` with a versioned fact ID;
- `NORMALIZED_STEP_RESULT` with a prior normalized step ID;
- `REASONING_QUANTITY` with an authored graph node ID.

A free string symbol is not a resolvable variable. Symbols remain display labels; source IDs are the authority.

### 4.4 Significant-figure evidence

A numeric value such as `450` does not by itself prove two or three significant figures. Gold artifacts therefore use unambiguous source forms such as:

```text
4.50 × 10² kPa
4.5 × 10² kPa
0.900
```

Every final significant-figure claim must have matching `QuantityValue.raw` and source transcription.

## 5. Reasoning graph and strategy contract

The graph describes semantic nodes and dependencies. It does not own requiredness. `AcceptedStrategyDefinition.nodeRequirements` is the only authority for whether a node is required on a particular accepted path.

Each strategy requirement records:

```ts
interface StrategyNodeRequirement {
  nodeId: string;
  requirement: "REQUIRED" | "OPTIONAL";
  allowedEvidenceKinds: ReasoningEvidenceKind[];
}
```

The required reasoning dependencies remain:

```text
relevant facts + Kp target
→ partial-pressure strategy
→ Kp relationship
→ substitution
→ arithmetic
→ unit and precision
```

### 5.1 Machine-distinct accepted strategies

The gold problem authors two structurally different strategies.

| Evidence | Explicit partial pressures | Compressed direct substitution |
| --- | --- | --- |
| total moles | `EQUATION` or `DECLARED_RESULT` | `EMBEDDED_CALCULATION` |
| mole fractions | `EQUATION` or `DECLARED_RESULT` | `EMBEDDED_CALCULATION` |
| partial pressures | `EQUATION` or `DECLARED_RESULT` | `EMBEDDED_CALCULATION` |
| Kp relationship | `FORMULA_AST` | complete embedded calculation |
| substitution | separate `EQUATION` | complete embedded calculation |

The explicit strategy therefore requires separately observable intermediate evidence. The compressed strategy permits those same dependencies to be established by one complete calculation AST. Removing an embedded dependency or presenting embedded evidence to the explicit path makes that strategy unsatisfied.

Directly substituting equilibrium amounts into the pressure expression is not an accepted compressed path. It is `WRONG_DEPENDENCY_USED`.

### 5.2 Solution sufficiency versus capability observation

Each reasoning node declares two evidence sets:

- `solutionEvidenceKinds` — enough to satisfy the dependency for solving the item;
- `independentStageEvidenceKinds` — enough to evaluate that cognitive stage as independently `CORRECT`.

These are intentionally different. Correct use of the three required facts may satisfy the solution dependency through `FACT_USE`, but it does not prove the learner independently identified which data matter. `DATA_EXTRACTION` remains `NOT_OBSERVED` unless there is explicit selection evidence.

`INFERRED` alignment may support navigation or review, but it never independently proves a cognitive stage correct.

## 6. Diagnosis contract

Decision, failure code, and stage status remain separate fields.

### 6.1 Trace-level decisions

| Decision | Meaning |
| --- | --- |
| `SOLVED` | Sufficient confirmed evidence supports a correct result. |
| `STUDENT_ERROR` | A confirmed pedagogical error was found in an unassisted or partially assisted attempt. |
| `INCOMPLETE_EVIDENCE` | Observed work is valid so far but does not establish a completed solution. |
| `RECOGNITION_UNCERTAIN` | Recognition must be confirmed or has abstained; no student error may be asserted. |
| `NOT_SOLVED` | A guided attempt remains incorrect after the authored level-4 scaffold. |

`RECOGNITION_UNCERTAIN` always has null failure code and null first pedagogical error. `NOT_SOLVED` may retain the confirmed final failure code and first error that remained after full scaffold.

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
| `CORRECT` | Independent confirmed evidence satisfies the stage contract. |
| `INCORRECT` | Confirmed evidence establishes a learner error. |
| `AMBIGUOUS_RECOGNITION` | This stage depends on unresolved recognition. |
| `NOT_OBSERVED` | The learner did not expose enough evidence to judge the capability. |
| `DOWNSTREAM_AFFECTED` | Evidence is present but inherits an earlier error. |
| `NOT_EVALUATED` | Recognition or missing dependencies prevent safe evaluation. |
| `SUPPORTED_BY_HINT` | The stage is satisfied only after assistance revealed required content. |

### 6.4 First pedagogically meaningful error

After recognition passes, the first `INCORRECT` stage in authored pedagogical order supplies `firstPedagogicalError` and the trace-level failure code.

- `NOT_OBSERVED` is not an error.
- Missing a separate optional line is not an error when an accepted embedded calculation supplies its dependency.
- `DOWNSTREAM_AFFECTED` does not invent a second failure.
- A later stage may remain `CORRECT` when independently verifiable.
- The policy makes no general error-carried-forward or mark-award claim.

## 7. Recognition contract

Step recognition is a single discriminated union:

- `AUTO_ACCEPTED` with confidence;
- `STUDENT_CONFIRMED` with selected transcription and candidates;
- `REQUIRES_CONFIRMATION` with candidates;
- `ABSTAINED` with a reason.

There is no separate `studentConfirmed`, `ambiguities`, or parallel step status that can contradict this union.

### 7.1 Attempt-level gate aggregation

The trace uses a separate `RecognitionGateDecision`:

```text
if any diagnosis-relevant artifact, region, or step is ABSTAINED
  → ABSTAINED
else if any diagnosis-relevant step or region REQUIRES_CONFIRMATION
  → REQUIRES_CONFIRMATION
else
  → PASSED
```

A mixed attempt may contain auto-accepted and student-confirmed steps while the aggregate gate is simply `PASSED`.

The gold thresholds are:

- confidence `>= 0.95`: auto-accept;
- confidence `>= 0.70` and `< 0.95`: local confirmation;
- confidence `< 0.70`: abstain.

Thresholds are versioned authored policy, not universal model constants.

When the gate is not `PASSED`:

- decision is `RECOGNITION_UNCERTAIN`;
- failure code and first pedagogical error are null;
- affected stages are `AMBIGUOUS_RECOGNITION` or `NOT_EVALUATED`;
- the product must not render a student-incorrect claim.

Interpretation may transcribe, segment, propose ASTs, map variables, and emit confidence and evidence regions. It may not decide correctness, failure codes, first error, marks, support outcome, or transfer mastery.

## 8. Revisions, assistance, and single-attempt support

`AttemptRevision` records:

- stable ID;
- global sequence;
- submission time;
- step IDs in that revision;
- assistance event IDs that immediately precede it.

`AssistanceEvent` records:

- stable ID and global sequence;
- stage, level, hint ID, and trigger;
- revealed reasoning-node IDs;
- stable authored content IDs;
- timestamp.

This establishes a reviewable sequence:

```text
revision 1: independent incomplete work
→ assistance event: formula hint
→ revision 2: corrected work explicitly linked to that event
```

Hint content is identified by stable graph/formula/content IDs. Arbitrary prose is not the only identity.

### 8.1 Attempt support outcome

PR #5 records `AttemptSupportOutcome`:

- `SOLVED_INDEPENDENTLY`;
- `SOLVED_AFTER_METACOGNITIVE_PROMPT`;
- `SOLVED_AFTER_STRATEGY_HINT`;
- `SOLVED_AFTER_FORMULA_HINT`;
- `SOLVED_USING_FULL_SCAFFOLD`;
- `NOT_SOLVED_AFTER_FULL_SCAFFOLD`;
- `INSUFFICIENT_EVIDENCE`.

This describes how one attempt was completed. It is not a mastery claim. Transfer mastery requires a separate, isomorphic transfer attempt with reduced assistance in PR #9.

## 9. Evidence trace V2

`DiagnosticEvidenceTraceV2` records:

- problem, graph, diagnosis, recognition, and hint-policy versions;
- interpreter/adapter/model/prompt versions when applicable;
- aggregate recognition gate and scoped recognition issues;
- normalized-step-to-node alignment with evidence kind;
- deterministic check evidence and tool versions;
- stage evaluations, decision, failure, and first error;
- ordered revisions and assistance events;
- attempt support outcome;
- submission identity and time.

Versions derive from immutable authored definitions, not UI state or learner input. PR #5 defines this shape only; runtime trace validation and persistence migration are deferred.

## 10. Gold problem and fixture matrix

The normative definition is [`src/fixtures/v2/kpGoldProblem.ts`](../src/fixtures/v2/kpGoldProblem.ts). Fixtures and expected outcomes are in [`src/fixtures/v2/kpNormalizedAttempts.ts`](../src/fixtures/v2/kpNormalizedAttempts.ts).

| Fixture | Contract behavior |
| --- | --- |
| `HANDWRITING_COMPLETE_CORRECT` | Explicit equations for total moles, mole fractions, both partial pressures, and final substitution. |
| `TYPED_COMPRESSED_CORRECT` | One complete AST satisfies compressed dependencies; data extraction remains unobserved. |
| `EXPLANATION_STRATEGY_ONLY` | Target, strategy, and formula observed; calculation stages unobserved. |
| `TYPED_INVERTED_FORMULA` | `FORMULA / INVERTED_RELATION`. |
| `TYPED_WRONG_SUBSTITUTION_DEPENDENCY` | `SUBSTITUTION / WRONG_DEPENDENCY_USED`. |
| `HANDWRITING_RECOGNITION_UNCERTAIN` | Local candidates require confirmation and block diagnosis. |
| `GUIDED_SOLVED_AFTER_FORMULA_HINT` | Pre-hint revision, formula event, and linked successful revision. |
| `DATA_IRRELEVANT_VOLUME_USED` | `DATA_EXTRACTION / IRRELEVANT_DATA_USED`. |
| `TARGET_MISIDENTIFIED_AS_KC` | `TARGET_IDENTIFICATION / TARGET_MISIDENTIFIED`. |
| `STRATEGY_USES_CONCENTRATION_ROUTE` | `STRATEGY / WRONG_METHOD`. |
| `ARITHMETIC_ERROR_AFTER_CORRECT_SUBSTITUTION` | Correct recomputable expression with wrong declared result. |
| `FINAL_UNIT_ERROR` | Correct expression and value with `UNIT / UNIT_ERROR`. |
| `FINAL_PRECISION_ERROR` | Correct value/unit with explicit two-significant-figure source. |
| `HANDWRITING_BELOW_THRESHOLD_ABSTAIN` | Artifact-level abstention before segmentation. |
| `HANDWRITING_CONFIRMED_THEN_DIAGNOSED` | Student-confirmed reading passes gate and is then diagnosed normally. |
| `GUIDED_NOT_SOLVED_AFTER_FULL_SCAFFOLD` | Level-4 event precedes a still-invalid revision and `NOT_SOLVED`. |

The fixtures are normalized gold artifacts. They do not claim an interpreter can already produce them.

## 11. Contract verification and evaluation plan

The V2 contract tests require:

- graph and strategy references resolve;
- explicit and compressed strategies differ structurally and behaviorally;
- deleting or exchanging required evidence makes a strategy unsatisfied;
- all eight cognitive error categories have a gold branch;
- substitution and arithmetic judgements have structured calculations;
- all fact, step, reasoning-node, artifact, revision, and assistance references resolve;
- source modality and source fields agree;
- recognition union and aggregate gate are distinct;
- recognition-gated attempts never become student errors;
- assistance precedes supported revisions;
- significant-figure claims have source evidence;
- first error and first incorrect stage agree;
- no single-attempt result uses the old mastery outcome field.

PR #6 must add runtime-schema rejection fixtures and implement the contract without reparsing raw text.

Later adapters must report separately:

- step-boundary precision and recall;
- semantic and concept mapping accuracy;
- AST exact or authored structural match;
- graph alignment precision and recall;
- confidence calibration and abstention rate;
- false-student-error rate caused by recognition.

Any false student-error caused by unresolved recognition blocks release and cannot be hidden in an aggregate score.

New gold artifacts require chemistry and contract review. New valid strategies, thresholds, or failure semantics require versioned definitions rather than fixture-only exceptions.

## 12. Delivery sequence

- PR #5: hardened measurement contract and gold corpus.
- PR #6: runtime validation, V1/structured and typed mock adapters, alignment, deterministic V2 diagnosis, and gold execution.
- PR #7: `Try it yourself` and `Guide me` UI using mock interpretation.
- PR #8: bounded server-side multimodal interpretation with local confirmation and no model grading.
- PR #9: targeted hints, retries, assistance reduction, an authored transfer item, and transfer mastery evidence.

No later PR may bypass recognition gating, reparse raw transcription inside deterministic diagnosis, or duplicate subject judgement by modality.
