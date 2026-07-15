# V2 Trainer Component Boundary

## Purpose

The V2 chemistry calculation trainer is a bounded Learning Foundry component. It is not a learner application, a chat surface, or a general chemistry service. Its public boundary lets a caller discover what the component supports, check fit before invocation, submit one supported normalized input, and receive a structured deterministic result.

The public exports live in `src/component/index.ts`. The default browser view is a developer inspector for this contract. The frozen V0.1 learner proof remains available with `?view=legacy`.

## Component manifest

The manifest identifies:

- component ID and version;
- curriculum and topic;
- the single supported immutable problem definition;
- supported tasks and input envelopes;
- structured outputs and deterministic guarantees;
- capabilities that are explicitly outside this component.

The current component supports only `KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2`. A matching task name is not enough to claim support for another Kp problem.

## Capability preflight

`preflightChemistryCalculationTrainer(request)` returns one of three coverage decisions:

| Coverage | Example | Recommended action |
| --- | --- | --- |
| `EXACT_MATCH` | Supported problem plus a normalized attempt, V0.1 structured submission, or explicit typed mock | `INVOKE_COMPONENT` |
| `PARTIAL_MATCH` | Supported problem supplied as handwriting or natural-language working | `REQUIRE_INTERPRETER` |
| `UNSUPPORTED` | A different problem definition or task | `USE_TEMPORARY_SUPPORT` or `RECORD_CAPABILITY_GAP` |

Partial match does not invoke OCR or parsing. It reports the missing interpreter and requires the caller to obtain and confirm a normalized attempt first. Unsupported requests do not widen the component at runtime.

The one-off versus repeated-demand recommendation is orchestration metadata only. This repository does not implement temporary learning artifacts or persist capability gaps.

## Invocation envelope

`invokeChemistryCalculationTrainer(invocation)` requires the request descriptor, one tagged input envelope, and caller-owned diagnosis context. The input kind must match the successful preflight request.

The three supported input envelopes are:

- `normalized-attempt`: an unknown value validated fail-closed by the V2 core;
- `legacy-seven-step-structured-input`: the bounded V0.1 adapter with full-scaffold provenance;
- `explicit-mock-scenario`: one of four authored typed-working fixtures.

The component owns adapter provenance for legacy and mock inputs. A caller cannot relabel those inputs as independent learner evidence.

## Result envelope

Every invocation returns component identity, component version, coverage, limitations, and one status:

- `COMPLETED`: the V2 core emitted a validated diagnosis trace;
- `RECOGNITION_UNCERTAIN`: the trace requires recognition confirmation;
- `INVALID_INPUT`: an exact-match invocation failed input or trace validation;
- `UNSUPPORTED`: preflight did not establish exact coverage.

Successful envelopes contain the complete V2 evidence trace, including the separate decision and failure code, first pedagogical error, interpreter provenance, revision-authoritative support outcome, and version metadata. Failure envelopes contain structured issues and do not fabricate a diagnosis.

## Responsibility boundary

The component owns:

- exact capability declaration and fit checking;
- bounded input adaptation;
- deterministic invocation of the merged V2 public API;
- structured result and limitation reporting.

A future Learning Foundry shell owns:

- request routing and component registry lookup;
- OCR, multimodal interpretation, and learner confirmation;
- temporary support when no component matches;
- capability-gap persistence and prioritisation;
- library, schedule, conversation, and cross-component orchestration.

Those Foundry responsibilities are intentionally absent here. No model, provider, server, registry, generic parser, or second problem topology is introduced by this boundary.
