import { describe, expect, it } from "vitest";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import { validateSupportedDiagnosticProblem } from "../src/domain/v2/supportedProblem";
import type {
  DiagnosticProblemDefinitionV2,
  NormalizedAttempt,
} from "../src/domain/v2/types";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import { guidedSolvedAfterFormulaHint } from "../src/fixtures/v2/kpNormalizedAttempts";

const context = {
  traceId: "problem-authority-support-trace",
  submittedAt: "2026-07-15T09:00:00.000Z",
  interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "support-causality-v1" },
};

function diagnose(attempt: NormalizedAttempt) {
  const result = diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.trace;
}

function threeRevisionFormulaAttempt(linkFinalRevision: boolean): NormalizedAttempt {
  const attempt = structuredClone(guidedSolvedAfterFormulaHint.attempt);
  const beforeHint = attempt.steps.find(({ id }) => id === "before-hint")!;
  const complete = attempt.steps.find(({ id }) => id === "after-hint")!;
  const partial = structuredClone(complete);
  Object.assign(partial, {
    id: "partial-after-hint",
    revisionId: "rev-2",
    semanticType: "FORMULA",
    concept: "KP_EXPRESSION",
    rawTranscription: "Kp = p(NO₂)² / p(N₂O₄)",
  });
  delete (partial as { calculation?: unknown }).calculation;
  Object.assign(complete, { revisionId: "rev-3" });
  Object.assign(attempt, {
    steps: [beforeHint, partial, complete],
    revisions: [
      attempt.revisions[0],
      {
        id: "rev-2",
        sequence: 3,
        submittedAt: "2026-07-14T08:00:00.000Z",
        stepIds: [partial.id],
        precededByAssistanceEventIds: ["assist-formula-1"],
      },
      {
        id: "rev-3",
        sequence: 4,
        submittedAt: "2026-07-14T08:01:00.000Z",
        stepIds: [complete.id],
        precededByAssistanceEventIds: linkFinalRevision ? ["assist-formula-1"] : [],
      },
    ],
  });
  return attempt;
}

describe("V2 exact supported-problem authority", () => {
  it.each([
    [
      "authored total pressure",
      (problem: DiagnosticProblemDefinitionV2) =>
        Object.assign(problem.authoredFacts.find(({ id }) => id === "total-pressure")!, {
          value: 501,
        }),
    ],
    [
      "target accepted unit",
      (problem: DiagnosticProblemDefinitionV2) =>
        Object.assign(problem.target, { acceptedUnits: ["Pa"] }),
    ],
    [
      "target significant figures",
      (problem: DiagnosticProblemDefinitionV2) =>
        Object.assign(problem.target, { significantFigures: 4 }),
    ],
    [
      "authored Kp formula",
      (problem: DiagnosticProblemDefinitionV2) => {
        const expression = problem.formulaDefinitions[0]!.expression;
        if (
          expression.kind !== "BINARY" ||
          expression.left.kind !== "BINARY" ||
          expression.left.operator !== "POWER" ||
          expression.left.right.kind !== "NUMBER"
        ) {
          throw new Error("Expected authored Kp power");
        }
        Object.assign(expression.left.right, { value: 3, raw: "3" });
      },
    ],
    [
      "strategy requirement",
      (problem: DiagnosticProblemDefinitionV2) =>
        Object.assign(problem.reasoningGraph.acceptedStrategies[0]!.nodeRequirements[0]!, {
          allowedEvidenceKinds: ["EXPLICIT_STEP"],
        }),
    ],
    [
      "recognition threshold",
      (problem: DiagnosticProblemDefinitionV2) =>
        Object.assign(problem.recognitionPolicy, { autoAcceptThreshold: 0.96 }),
    ],
    [
      "hint reveal node",
      (problem: DiagnosticProblemDefinitionV2) =>
        Object.assign(
          problem.hintPolicy.hints.find(({ id }) => id === "FORMULA-KP-01")!,
          { revealedReasoningNodeIds: ["identify-kp-target"] },
        ),
    ],
  ])("rejects mutated canonical content: %s", (_label, mutate) => {
    const problem = structuredClone(kpGoldProblemV2);
    mutate(problem);

    expect(validateSupportedDiagnosticProblem(problem)).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "UNSUPPORTED_PROBLEM_DEFINITION" })],
    });
  });

  it("accepts a structured clone whose object key insertion order differs", () => {
    const problem = structuredClone(kpGoldProblemV2);
    const reversedNodes = Object.fromEntries(
      Object.entries(problem.reasoningGraph.nodes).reverse(),
    );
    Object.assign(problem.reasoningGraph, { nodes: reversedNodes });

    expect(validateSupportedDiagnosticProblem(problem)).toEqual({ ok: true, value: problem });
  });
});

describe("V2 decision-revision support causality", () => {
  it("does not attribute a historical formula hint to an unlinked successful revision", () => {
    const trace = diagnose(threeRevisionFormulaAttempt(false));

    expect(trace).toMatchObject({
      decision: "SOLVED",
      attemptSupportOutcome: "SOLVED_INDEPENDENTLY",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "FORMULA")).toMatchObject({
      status: "CORRECT",
    });
  });

  it("attributes formula support only when the successful revision directly links the hint", () => {
    const trace = diagnose(threeRevisionFormulaAttempt(true));

    expect(trace).toMatchObject({
      decision: "SOLVED",
      attemptSupportOutcome: "SOLVED_AFTER_FORMULA_HINT",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "FORMULA")).toMatchObject({
      status: "SUPPORTED_BY_HINT",
      evidenceStepIds: ["after-hint"],
    });
    expect(trace.deterministicChecks.find(({ category }) => category === "FORMULA")).toMatchObject({
      outcome: "PASS",
    });
  });
});
