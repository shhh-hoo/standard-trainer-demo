# AGENTS.md

## Repository Role

This repository contains the runnable Standards-First Learning Trainer demo. Sprint planning, market research, product specifications, eval design, interview preparation, and portfolio evidence live in [10-Day-Challenge](https://github.com/shhh-hoo/10-Day-Challenge).

The repositories are independent siblings, not Git submodules. Do not copy the other repository into this one.

## Product Boundary

Build a Cambridge A-Level Chemistry Dynamic Equilibrium Concept Boundary Trainer, not a generic chatbot or study helper.

The core loop is answer -> standard-grounded judgement -> missing-element explanation -> rewrite -> second judgement -> evidence archive -> expert review when uncertain.

## Implementation Rules

- Link the relevant challenge specification and commit in each product PR.
- Keep implementation diffs scoped to one accepted ticket.
- Use deterministic rubric checks first, constrained model judgement second, verifier third, and human review fallback.
- Route all model calls through a server-side AI gateway or explicit mock gateway.
- Never expose provider, billing, or service-role secrets in client code.
- Label mock auth, usage, billing, and AI-draft content clearly.
- Add the smallest relevant test or eval for non-trivial behavior.
- Do not implement real Stripe in V0.

## Git Rule

When adding a feature, create a `codex/` feature branch and submit it through a pull request. Do not commit or push feature work directly to `main`.
