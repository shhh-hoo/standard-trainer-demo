# V2 Trainer Component Boundary

## Purpose

The V2 chemistry calculation trainer is a bounded Learning Foundry component. It is not a learner application, a chat surface, a routing policy, or a general chemistry service. Its public boundary lets a caller discover exact operational coverage, determine whether interpretation is still required, invoke one supported normalized path, and receive a structured deterministic result.

The public exports live in `src/component/index.ts`. The default browser view is a developer inspector for this contract. The frozen V0.1 learner proof remains available with `?view=legacy`.

## Component manifest

The versioned manifest identifies:

- manifest schema, component identity, and component version;
- curriculum, topic, and the single supported immutable problem definition;
- the Foundry-facing task `diagnose-calculation-attempt`;
- operational inputs and the `normalized-attempt` execution requirement;
- measurement-contract and problem-definition dependencies;
- structured outputs, deterministic guarantees, and explicit limitations;
- developer fixtures, separately from operational capabilities.

The two operational inputs are `normalized-attempt` and `legacy-seven-step-structured-input`. The four authored developer fixtures are visible for inspection but are not learner inputs, registry-discoverable capabilities, or contract dependencies.

The current component supports only `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2`. A matching user task is not enough to claim support for another Kp problem.

## Capability preflight

`preflightChemistryCalculationTrainer(request)` returns one of three coverage decisions:

| Coverage | Example | Component action |
| --- | --- | --- |
| `EXACT_MATCH` | Supported task and problem with a normalized attempt or bounded legacy submission | `INVOKE_COMPONENT` |
| `PARTIAL_MATCH` | Supported task and problem supplied as handwriting, digital ink, a scan, mixed working, or natural-language working | `REQUIRE_INTERPRETER` |
| `UNSUPPORTED` | A different task, problem definition, or non-operational input such as a developer fixture | `DO_NOT_INVOKE` |

The task describes the learner intent; normalization is an execution precondition. Partial match does not invoke OCR or parsing. It reports the missing interpreter and requires the caller to obtain and confirm a normalized attempt first.

Preflight returns boolean `matchDimensions` for task, problem definition, and input readiness. It deliberately returns no global fit score: cross-component ranking and calibration belong to the Foundry Registry.

Unsupported requests receive no fallback policy. Temporary support, human review, component composition, gap recording, and component evolution are all Foundry decisions outside this component.

## Operational invocation

`invokeChemistryCalculationTrainer(invocation: unknown)` is a fail-closed runtime boundary suitable for JSON or tool-call transport. Before the V2 core can run it validates the request descriptor, tagged input envelope, request/input agreement, trace ID, ISO timestamp, and interpreter metadata. Malformed envelopes return `INVALID_INPUT`; they do not throw.

Only two input envelopes can reach deterministic diagnosis:

- `normalized-attempt`: an unknown attempt validated by the V2 core;
- `legacy-seven-step-structured-input`: the bounded V0.1 adapter with full-scaffold provenance.

Interpreter-required inputs return `REQUIRES_INTERPRETER` without invoking the core. Other tasks, problems, and input kinds return `NOT_INVOKED_UNSUPPORTED`.

The result envelope includes the complete preflight resolution, so the caller receives coverage, match dimensions, missing capabilities, limitations, and the component action without reconstructing policy. Validation issues retain `path`, `code`, and `message`, including paths emitted by the V2 validators.

## Provenance ownership

For a normalized attempt, the caller supplies `traceId`, `submittedAt`, and interpreter metadata. The Trainer preserves that provenance but does not independently prove its truth.

For a legacy submission, the component fixes the interpreter kind/version and uses `submission.submittedAt` as the trace timestamp. Caller context cannot relabel or retime adapter-owned evidence.

## Developer fixture runner

`invokeChemistryCalculationTrainerDeveloperScenario(...)` runs one of four authored typed-working fixtures for the inspector and tests. It is explicitly developer-only, absent from `LearningComponent.invoke`, and absent from operational preflight. The component fixes `TYPED_WORKING_MOCK@typed-working-mock-v1` provenance and uses the fixture input timestamp.

This API is not NLP, parser evidence, a learner input, or a registry route.

## Result statuses

Every public invocation returns component identity, version, coverage, preflight resolution, limitations, and one status:

- `COMPLETED`: the V2 core emitted a validated diagnosis trace;
- `RECOGNITION_UNCERTAIN`: the trace requires recognition confirmation;
- `INVALID_INPUT`: the component envelope or normalized attempt failed validation;
- `REQUIRES_INTERPRETER`: the task and problem fit, but the input is not normalized;
- `NOT_INVOKED_UNSUPPORTED`: the task, problem, or operational input is outside coverage.

Successful envelopes contain the complete V2 evidence trace, including separate decision and failure code, first pedagogical error, interpreter provenance, revision-authoritative support outcome, and version metadata. Failure envelopes contain structured issues and never fabricate a diagnosis.

## Responsibility boundary

The component owns:

- exact capability declaration and input-readiness checking;
- fail-closed operational invocation and bounded input adaptation;
- deterministic invocation of the merged V2 public API;
- structured result, limitation, and validation-issue reporting.

A future Learning Foundry shell owns:

- request routing and component registry lookup;
- OCR, multimodal interpretation, and learner confirmation;
- temporary support or human intervention when no component matches;
- capability-gap persistence and prioritisation;
- library, schedule, conversation, and cross-component orchestration.

Those Foundry responsibilities are intentionally absent here. No model, provider, server, registry, generic parser, or second problem topology is introduced by this boundary.
