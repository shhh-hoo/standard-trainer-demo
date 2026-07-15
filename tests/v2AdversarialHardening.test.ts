import { describe, expect, it } from "vitest";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import type { ExpressionAst, NormalizedAttempt, VariableReference } from "../src/domain/v2/types";
import { adaptV1SubmissionToV2 } from "../src/adapters/v2/v1StructuredAdapter";
import type { StudentStepInput } from "../src/domain/types";
import { kpFromEquilibriumMoles } from "../src/fixtures/kpFromEquilibriumMoles";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  completeHandwritingCorrect,
  compressedTypedCorrect,
  guidedNotSolvedAfterFullScaffold,
  guidedSolvedAfterFormulaHint,
} from "../src/fixtures/v2/kpNormalizedAttempts";

const context = {
  traceId: "adversarial-hardening-trace",
  submittedAt: "2026-07-15T03:00:00.000Z",
  interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "adversarial-v1" },
};

function diagnose(attempt: NormalizedAttempt) {
  const result = diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.trace;
}

function replaceDisplaySymbols(expression: ExpressionAst, prefix: string): void {
  if (expression.kind === "VARIABLE") {
    Object.assign(expression.reference as VariableReference, {
      symbol: `${prefix}-${
        expression.reference.source === "AUTHORED_FACT"
          ? expression.reference.factId
          : expression.reference.source === "NORMALIZED_STEP_RESULT"
            ? expression.reference.stepId
            : expression.reference.reasoningNodeId
      }`,
    });
  } else if (expression.kind === "BINARY") {
    replaceDisplaySymbols(expression.left, prefix);
    replaceDisplaySymbols(expression.right, prefix);
  } else if (expression.kind === "FUNCTION") {
    expression.arguments.forEach((argument) => replaceDisplaySymbols(argument, prefix));
  }
}

function diagnosticProjection(trace: ReturnType<typeof diagnose>) {
  return {
    recognitionGateDecision: trace.recognitionGateDecision,
    decision: trace.decision,
    failureCode: trace.failureCode,
    firstPedagogicalError: trace.firstPedagogicalError,
    attemptSupportOutcome: trace.attemptSupportOutcome,
    stageEvaluations: trace.stageEvaluations,
    deterministicChecks: trace.deterministicChecks,
  };
}

describe("V2 adversarial diagnosis hardening", () => {
  it("validates a correct embedded compressed formula without a separate formulaAst", () => {
    const attempt = structuredClone(compressedTypedCorrect.attempt);
    delete (attempt.steps[0] as { formulaAst?: unknown }).formulaAst;

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({ decision: "SOLVED", failureCode: null });
    expect(trace.stageEvaluations.find(({ category }) => category === "DATA_EXTRACTION")).toMatchObject({
      status: "NOT_OBSERVED",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "TARGET_IDENTIFICATION")).toMatchObject({
      status: "NOT_OBSERVED",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "FORMULA")).toMatchObject({
      status: "CORRECT",
      evidenceStepIds: ["working"],
    });
    expect(trace.alignmentEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedStepId: "working",
          reasoningNodeIds: ["construct-kp-expression"],
          evidenceKind: "EMBEDDED_CALCULATION",
        }),
      ]),
    );
  });

  it("rejects an internally consistent compressed calculation that squares the wrong species", () => {
    const attempt = structuredClone(compressedTypedCorrect.attempt);
    const step = attempt.steps[0]!;
    delete (step as { formulaAst?: unknown }).formulaAst;
    const expression = step.calculation!.expression;
    if (
      expression.kind !== "BINARY" ||
      expression.operator !== "DIVIDE" ||
      expression.left.kind !== "BINARY" ||
      expression.left.operator !== "POWER"
    ) {
      throw new Error("Expected compressed Kp expression");
    }
    const no2PartialPressure = expression.left.left;
    const n2o4PartialPressure = expression.right;
    Object.assign(expression.left, { left: n2o4PartialPressure });
    Object.assign(expression, { right: no2PartialPressure });
    const wrongResult = {
      value: 40000 / 300,
      unit: "kPa",
      significantFigures: 3,
      raw: "133 kPa",
    };
    Object.assign(step.calculation!, { declaredResult: wrongResult });
    Object.assign(attempt, { finalAnswer: wrongResult });

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({
      decision: "STUDENT_ERROR",
      failureCode: "WRONG_STOICHIOMETRIC_POWER",
      firstPedagogicalError: "FORMULA",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "FORMULA")).toMatchObject({
      status: "INCORRECT",
      failureCode: "WRONG_STOICHIOMETRIC_POWER",
      evidenceStepIds: ["working"],
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "SUBSTITUTION")).toMatchObject({
      status: "DOWNSTREAM_AFFECTED",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "ARITHMETIC")).toMatchObject({
      status: "DOWNSTREAM_AFFECTED",
    });
  });

  it("treats every VariableReference symbol as display-only metadata", () => {
    const changed = structuredClone(compressedTypedCorrect.attempt);
    const step = changed.steps[0]!;
    replaceDisplaySymbols(step.formulaAst!, "formula-display");
    replaceDisplaySymbols(step.calculation!.expression, "calculation-display");
    Object.assign(step.calculation!.target, { symbol: "target-display" });

    expect(diagnosticProjection(diagnose(changed))).toEqual(
      diagnosticProjection(diagnose(compressedTypedCorrect.attempt)),
    );
  });

  it("does not treat FACT_USE as independent data-extraction evidence", () => {
    const attempt = structuredClone(completeHandwritingCorrect.attempt);
    Object.assign(attempt, {
      steps: attempt.steps.filter(({ id }) => id !== "data"),
    });
    Object.assign(attempt.revisions[0]!, {
      stepIds: attempt.revisions[0]!.stepIds.filter((id) => id !== "data"),
    });
    attempt.factsUsed.forEach((factUse) =>
      Object.assign(factUse, { evidenceStepIds: ["total"] }),
    );

    const trace = diagnose(attempt);
    expect(trace.decision).toBe("SOLVED");
    expect(trace.stageEvaluations.find(({ category }) => category === "DATA_EXTRACTION")).toMatchObject({
      status: "NOT_OBSERVED",
    });
  });

  it("uses revision order rather than attempt.steps array order as temporal authority", () => {
    for (const fixture of [
      completeHandwritingCorrect,
      guidedSolvedAfterFormulaHint,
      guidedNotSolvedAfterFullScaffold,
    ]) {
      const reordered = structuredClone(fixture.attempt);
      Object.assign(reordered, { steps: [...reordered.steps].reverse() });

      expect(diagnosticProjection(diagnose(reordered)), fixture.id).toEqual(
        diagnosticProjection(diagnose(fixture.attempt)),
      );
    }
  });

  it("keeps deterministic PASS evidence separate from hint-supported stage status", () => {
    const hintedTrace = diagnose(guidedSolvedAfterFormulaHint.attempt);
    expect(hintedTrace.stageEvaluations.find(({ category }) => category === "FORMULA")).toMatchObject({
      status: "SUPPORTED_BY_HINT",
    });
    expect(hintedTrace.deterministicChecks.find(({ category }) => category === "FORMULA")).toMatchObject({
      outcome: "PASS",
    });

    const canonicalSteps: Record<string, StudentStepInput> = {
      totalMoles: { numericValue: 1, unit: "mol" },
      moleFractionN2O4: { numericValue: 0.4 },
      moleFractionNO2: { numericValue: 0.6 },
      partialPressureN2O4: { numericValue: 200, unit: "kPa" },
      partialPressureNO2: { numericValue: 300, unit: "kPa" },
      kpExpression: { expression: "p(NO2)^2 / p(N2O4)" },
      kpResult: { numericValue: 450, unit: "kPa", significantFigures: 3 },
    };
    const adapted = adaptV1SubmissionToV2(kpFromEquilibriumMoles, {
      attemptId: "adversarial-v1-canonical",
      submittedAt: "2026-07-15T02:59:00.000Z",
      steps: canonicalSteps,
    });
    if (!adapted.ok) throw new Error(adapted.message);
    const adaptedTrace = diagnose(adapted.attempt);
    for (const category of ["STRATEGY", "FORMULA", "SUBSTITUTION"] as const) {
      expect(
        adaptedTrace.stageEvaluations.find((stage) => stage.category === category),
        category,
      ).toMatchObject({ status: "SUPPORTED_BY_HINT" });
      expect(
        adaptedTrace.deterministicChecks.find((check) => check.category === category),
        category,
      ).toMatchObject({ outcome: "PASS" });
    }
    for (const category of ["ARITHMETIC", "UNIT", "PRECISION"] as const) {
      expect(
        adaptedTrace.stageEvaluations.find((stage) => stage.category === category),
        category,
      ).toMatchObject({ status: "CORRECT" });
    }
  });

  it("reports not solved when the latest revision remains incomplete after level-4 support", () => {
    const attempt = structuredClone(guidedNotSolvedAfterFullScaffold.attempt);
    const afterScaffold = attempt.steps.find(({ id }) => id === "after-scaffold")!;
    delete (afterScaffold as { formulaAst?: unknown }).formulaAst;
    delete (afterScaffold as { calculation?: unknown }).calculation;
    Object.assign(afterScaffold, {
      semanticType: "STRATEGY",
      concept: null,
      rawTranscription: "I still cannot complete the calculation.",
    });
    Object.assign(attempt, { finalAnswer: null });

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({
      decision: "NOT_SOLVED",
      failureCode: null,
      firstPedagogicalError: null,
      attemptSupportOutcome: "NOT_SOLVED_AFTER_FULL_SCAFFOLD",
    });
  });

  it("rejects a schema-valid problem outside the single supported gold definition", () => {
    const unsupportedProblem = structuredClone(kpGoldProblemV2);
    Object.assign(unsupportedProblem, {
      id: "KP_FROM_EQUILIBRIUM_MOLES_V2_OTHER",
      version: "2.0.0-other",
    });
    const attempt = structuredClone(compressedTypedCorrect.attempt);
    Object.assign(attempt, {
      problemDefinitionId: unsupportedProblem.id,
      problemDefinitionVersion: unsupportedProblem.version,
    });

    const result = diagnoseNormalizedAttempt(unsupportedProblem, attempt, context);
    expect(result).toMatchObject({
      ok: false,
      kind: "INVALID_PROBLEM",
      issues: [
        expect.objectContaining({ code: "UNSUPPORTED_PROBLEM_DEFINITION" }),
      ],
    });
  });
});
