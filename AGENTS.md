# AGENTS.md

## Repository Role

This repository contains the runnable Calculation Path Trainer proof, its public product rationale, architecture, tests, and release evidence. Broader private planning materials are maintained separately and are not part of this repository.

This repository is independent, not a Git submodule. Do not copy separate private planning materials into it.

## Product Boundary

Build a Cambridge A-Level Chemistry calculation-path diagnosis product, not a generic chatbot or study helper.

The initial core loop is structured student steps -> deterministic tool checks -> first-invalid-step diagnosis -> versioned evidence trace.

## Implementation Rules

- Link a public specification, decision record, case study section, or issue in each product PR when one exists.
- Do not place inaccessible private-repository links in public evidence.
- Keep implementation diffs scoped to one accepted ticket.
- Keep the domain engine pure and deterministic.
- Treat decisions and failure codes as separate fields.
- Derive trace versions from immutable problem and graph definitions, not UI input.
- Add the smallest relevant test for non-trivial behavior.
- Do not add LLM calls, arbitrary parsers, question generation, or a general ECF claim without a later accepted ticket.
- If later tickets add model calls, route them through a server-side gateway and never expose provider or service-role secrets in client code.
- Do not implement real Stripe in V0.

## Git Rule

When adding a feature, create a `codex/` feature branch and submit it through a pull request. Do not commit or push feature work directly to `main`.
