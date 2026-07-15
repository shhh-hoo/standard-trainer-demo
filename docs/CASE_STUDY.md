# Case Study: Proving Calculation-Path Diagnosis Before Adding AI

## 1. Context

Standard Trainer is a runnable product proof for Cambridge A-Level Chemistry-style structured calculations. It is now the first downstream consumer of Learning Foundry: the runtime loads two governed published components while retaining the original V0.1 and legacy V2 Kp assets as regression evidence. The published Kp component is explicitly a simplified migration with bounded happy-path compatibility.

This is not a complete learning platform. It is evidence that the central calculation-path mechanism can be represented, evaluated, tested, and explained before broader product capabilities are funded.

## 2. Product problem

A final-answer checker can tell a learner that `450 kPa` is right or wrong, but it cannot show where a multi-step method first became invalid. A general tutor may produce a plausible explanation, yet that explanation can be difficult to reproduce or audit. The product question was therefore more specific: can a learner submit structured working and receive a stable identification of the first invalid step, with enough trace evidence to inspect why the decision occurred?

The desired output is diagnostic rather than generative. A valid path receives `VALID_PATH`. An invalid or incomplete path receives a separate decision and failure code, the first affected step ID, and an ordered record of what was and was not evaluated.

## 3. Why not start with an LLM

An LLM would add value later if learners submit varied natural language, but it would obscure the first technical question: whether the authored calculation contract itself is coherent. Starting with a model would mix parsing errors, chemistry reasoning, prompt behavior, and product policy into one result.

The core proof therefore makes no model call. Structured fields remove interpretation ambiguity, while deterministic tools make failures reproducible. This is a product-boundary decision, not a claim that deterministic rules can handle arbitrary chemistry. It creates a stable baseline against which a later constrained parser could be measured.

## 4. Scope decision

The slice contains two bounded target adapters: Kp from equilibrium amounts and stoichiometric product mass. Learner input remains structured, version-pinned evidence. There are no generated questions, learner model, authentication, agent orchestration, or general question parser.

The system also makes no error-carried-forward claim. Once the first invalid step is found, subsequent steps are marked `NOT_EVALUATED`. That behavior prevents cascading duplicate diagnoses, but it does not decide whether downstream method marks should be awarded.

## 5. Architecture

An immutable, versioned `ProblemDefinition` owns the prompt, givens, canonical graph, step order, dependencies, and expected values. A pure calculation-path engine visits the seven authored steps in canonical order. It calls small deterministic tools for numeric tolerance, curated expression variants, units, and significant figures.

The first failed tool determines the trace-level failure code and first-invalid-step ID. The engine emits an evidence trace containing problem, schema, graph, engine, and tool versions. React is limited to collecting labeled inputs and rendering the result; it does not determine authority or evaluation semantics.

Dependencies are explicit evidence in the graph, but the current evaluator does not perform dynamic graph scheduling. It follows `orderedStepIds`, whose consistency and dependency order are protected by tests.

## 6. Evaluation model

Decisions and failure codes are intentionally separate. `VALID_PATH` has no failure code. `INCOMPLETE_PATH` pairs with `MISSING_STEP`. Other deterministic mismatches produce `INVALID_PATH` with `NUMERIC_MISMATCH`, `EXPRESSION_MISMATCH`, `UNIT_MISMATCH`, or `SIGNIFICANT_FIGURES_MISMATCH`.

Within a step, checks run in a fixed order: numeric value, curated expression, unit, then significant figures. The expression tool normalizes only a small authored set of representations, including Unicode chemical subscripts. It is a versioned whitelist matcher, not fuzzy matching or symbolic algebra. This bounded contract keeps acceptance behavior understandable and testable.

## 7. Evidence and persistence

Every submission produces a structured trace with the inputs considered, dependency edges, step statuses, messages, tool versions, final decision, failure code, and timestamp. A runtime validator checks the trace shape and internal decision/evaluation consistency before it can enter the archive or JSON export.

Persistence is deliberately honest. A successful browser write is labeled `PERSISTED`. If storage is unavailable or corrupted, a valid trace can remain `MEMORY_ONLY` for the current tab and can still be exported. Invalid traces return `FAILED`. Corrupted stored data is not passed into React and is not silently overwritten.

This is not tamper-proof storage. `localStorage` and exported JSON are controlled by the browser user, and structural validation is not a signature or cryptographic integrity proof.

## 8. Testing and CI

The frozen V0.1 15-test suite covers the valid canonical path, the four deterministic check dimensions, Unicode-subscript expression input, first-invalid-step stopping behavior, missing steps, graph consistency, evidence validation, persistence fallbacks, JSON export, and key UI outcomes. The graph tests verify both dependency existence and order and ensure the step map has no orphan definitions. The hardened V2 measurement contract adds fifteen fixture-integrity tests for recomputable equations, strategy evidence, recognition gating, diagnosis coverage, and assistance causality without changing the V0.1 runtime.

The V2 deterministic core adds fifty runtime tests around fail-closed validation, AST evaluation, recognition gating, exact 16-fixture diagnosis, embedded and explicit-equation adversaries, commutative forms, display-symbol metamorphism, independent evidence, canonical problem authority, revision-order invariance, decision-revision support causality, trace consistency, the V1 adapter, and four typed mock scenarios. Exact gold match plus adversarial coverage demonstrates execution of the authored bounded contract; it does not demonstrate curriculum coverage.

GitHub Actions installs from the lockfile, type-checks, runs the tests, and creates a production build. A separate Pages workflow repeats verification before producing the deployable artifact. This makes the public demo downstream of the same checks used for engineering review.

## 9. Trade-offs

Structured input reduces realism compared with free-form learner work, but it isolates engine correctness. A single problem cannot demonstrate curriculum breadth, yet it keeps the proof reviewable. Canonical-order evaluation is simpler than a general graph executor, while still preserving dependency metadata for later experiments.

Browser-only persistence keeps deployment small and transparent. The cost is that evidence is neither centrally available nor protected from local modification. These trade-offs are acceptable for a public core proof and would be inappropriate to hide in a production claim.

## 10. Current limitations

The project does not perform arbitrary chemistry reasoning, natural-language parsing, arbitrary expression parsing, question generation, learner modelling, bounded or general ECF, or agentic workflow orchestration. It has no production authentication, remote database, analytics, or security control plane. Two governed components do not establish broad exam-board coverage.

The V2 typed-working adapter is explicitly a mock scenario selector, not NLP. Its Kp semantics remain finite and authored rather than topology-generic or general algebra. The separate Foundry Kp adapter does not claim full V2 semantic preservation: it proves bounded structured happy-path decision parity and declares the omitted capabilities in migration metadata. Published component identity is enforced through canonical schema validation, exact manifest/file mapping, content hash, capability profile, internal-reference validation, and the target adapter registry. The repository still contains no OCR, real parser, server endpoint, or model call.

Accordingly, the evidence supports only this claim: for the frozen V0.1 path and the authored V2 gold evidence corpus, the deterministic engines identify the first relevant invalid stage and emit validated, versioned traces.

## 11. Component boundary

The deterministic V2 runtime is now packaged as a bounded Learning Foundry trainer component rather than expanded into a standalone learning product. Its versioned public manifest states exact subject, problem, operational input, and contract-dependency coverage. Capability preflight separates learner task intent from the normalized execution requirement, returns explicit match dimensions rather than a global fit score, and distinguishes exact requests from requests that still need an interpreter and requests that do not fit at all.

The public invocation boundary accepts unknown transport data, fails closed without throwing, preserves validation issue paths, and protects adapter-owned interpreter and timestamp provenance. The accompanying developer inspector demonstrates those boundaries and four authored fixtures through a separate developer-only API. It is not a learner workflow. Routing, OCR, natural-language interpretation, confirmation, temporary support, capability-gap persistence, library, schedule, and cross-component orchestration remain responsibilities of a later Foundry shell.

## 12. Next validated experiments

Potential follow-on work should remain hypothesis-led rather than being assumed as product scope:

1. Build a separate Learning Foundry shell that routes a learner request through manifest lookup and capability preflight before showing any component experience.
2. Add explicit interpreter and learner-confirmation contracts without treating raw handwriting or free text as normalized evidence.
3. Author a second calculation topology and test whether the graph and tool contracts generalize without engine-specific exceptions.
4. Specify a bounded, human-reviewed ECF policy and evaluate marking agreement separately from path diagnosis.
5. Define a human-reviewed hint contract tied to evidence codes, then test whether it supports repair without revealing the complete method.
6. Evaluate later constrained model-assisted parsing against the deterministic structured-input baseline, with explicit abstention and review behavior.

These are candidates, not implemented capabilities. The present release remains a curated calculation-path core proof.
