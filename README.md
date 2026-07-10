# Standards-First Learning Trainer Demo

Runnable product repository for the A-Level Chemistry Dynamic Equilibrium Concept Boundary Trainer.

## Repository Relationship

This repository is an independent sibling of [10-Day-Challenge](https://github.com/shhh-hoo/10-Day-Challenge), not a Git submodule.

- Challenge repository: sprint plan, PRD, architecture, AI/eval specifications, market research, interview preparation, status, and portfolio evidence.
- Demo repository: application code, runnable fixtures, implementation tests, demo instructions, and deployment configuration.

The challenge repository links to demo PRs and results. Neither repository tracks the other's commit pointer.

## Canonical Specifications

- [Product requirements](https://github.com/shhh-hoo/10-Day-Challenge/blob/main/docs/product/PRD.md)
- [Architecture](https://github.com/shhh-hoo/10-Day-Challenge/blob/main/docs/architecture/ARCHITECTURE.md)
- [Answer-judgement harness](https://github.com/shhh-hoo/10-Day-Challenge/blob/main/docs/ai/HARNESS_SPEC.md)
- [Evaluation plan](https://github.com/shhh-hoo/10-Day-Challenge/blob/main/docs/evals/EVAL_PLAN.md)
- [Implementation task template](https://github.com/shhh-hoo/10-Day-Challenge/blob/main/docs/implementation/CODEX_TASK_TEMPLATE.md)

## Current State

Repository initialized; product code has not been implemented.

## First Implementation Ticket

After Day 1-3 acceptance gates pass, build the smallest local three-panel loop using static Dynamic Equilibrium data and deterministic checks:

`standard panel -> student answer -> feedback -> forced rewrite -> evidence archive`

Exclude live AI, production authentication, Stripe, broad content ingestion, and autonomous agents from this ticket.
