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

describe("V2 bounded structural problem authority", () => {
  it("accepts authored content variation instead of enforcing one serialized fixture", () => {
    const problem = structuredClone(kpGoldProblemV2);
    Object.assign(problem.authoredFacts.find(({ id }) => id === "total-pressure")!, { value: 501 });
    Object.assign(problem.target, { acceptedUnits: ["Pa"], significantFigures: 4 });

    expect(validateSupportedDiagnosticProblem(problem)).toEqual({ ok: true, value: problem });
  });

  it.each([
    ["unresolved graph dependency", (problem: DiagnosticProblemDefinitionV2) => Object.assign(problem.reasoningGraph.nodes["calculate-result"]!, { dependencies: ["missing-node"] })],
    ["unresolved formula fact", (problem: DiagnosticProblemDefinitionV2) => {
      const expression = problem.formulaDefinitions[0]!.expression;
      if (expression.kind !== "BINARY" || expression.right.kind !== "VARIABLE" || expression.right.reference.source !== "REASONING_QUANTITY") throw new Error("Unexpected fixture");
      Object.assign(expression.right.reference, { reasoningNodeId: "missing-node" });
    }],
    ["unresolved hint node", (problem: DiagnosticProblemDefinitionV2) => Object.assign(problem.hintPolicy.hints[0]!, { revealedReasoningNodeIds: ["missing-node"] })],
  ])("rejects malformed internal references: %s", (_label, mutate) => {
    const problem = structuredClone(kpGoldProblemV2);
    mutate(problem);
    expect(validateSupportedDiagnosticProblem(problem)).toMatchObject({ ok: false, issues: [expect.objectContaining({ code: "UNSUPPORTED_PROBLEM_DEFINITION" })] });
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
