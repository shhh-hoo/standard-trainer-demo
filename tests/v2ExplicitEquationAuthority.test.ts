import { describe, expect, it } from "vitest";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import type { NormalizedAttempt } from "../src/domain/v2/types";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import { completeHandwritingCorrect } from "../src/fixtures/v2/kpNormalizedAttempts";

const context = {
  traceId: "explicit-equation-authority-trace",
  submittedAt: "2026-07-15T09:00:00.000Z",
  interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "equation-authority-v1" },
};

function diagnose(attempt: NormalizedAttempt) {
  const result = diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.trace;
}

describe("V2 explicit equation semantic authority", () => {
  it("rejects a species-swapped final substitution even when its arithmetic is correct", () => {
    const attempt = structuredClone(completeHandwritingCorrect.attempt);
    const final = attempt.steps.find(({ id }) => id === "final")!;
    const expression = final.calculation!.expression;
    if (
      expression.kind !== "BINARY" ||
      expression.operator !== "DIVIDE" ||
      expression.left.kind !== "BINARY" ||
      expression.left.operator !== "POWER"
    ) {
      throw new Error("Expected explicit final Kp expression");
    }
    const no2Pressure = expression.left.left;
    const n2o4Pressure = expression.right;
    Object.assign(expression.left, { left: n2o4Pressure });
    Object.assign(expression, { right: no2Pressure });
    const wrongResult = {
      value: 40000 / 300,
      unit: "kPa",
      significantFigures: 3,
      raw: "133 kPa",
    };
    Object.assign(final.calculation!, { declaredResult: wrongResult });
    Object.assign(attempt, { finalAnswer: wrongResult });

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({
      decision: "STUDENT_ERROR",
      firstPedagogicalError: "SUBSTITUTION",
      failureCode: "WRONG_DEPENDENCY_USED",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "ARITHMETIC")).toMatchObject({
      status: "DOWNSTREAM_AFFECTED",
    });
  });

  it("locates a duplicated-species total-moles dependency before arithmetic", () => {
    const attempt = structuredClone(completeHandwritingCorrect.attempt);
    const total = attempt.steps.find(({ id }) => id === "total")!;
    const expression = total.calculation!.expression;
    if (expression.kind !== "BINARY" || expression.operator !== "ADD") {
      throw new Error("Expected total-moles addition");
    }
    Object.assign(expression, { right: structuredClone(expression.left) });
    Object.assign(total.calculation!, {
      declaredResult: {
        value: 0.8,
        unit: "mol",
        significantFigures: 3,
        raw: "0.800 mol",
      },
    });

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({
      decision: "STUDENT_ERROR",
      firstPedagogicalError: "SUBSTITUTION",
      failureCode: "WRONG_DEPENDENCY_USED",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "SUBSTITUTION")).toMatchObject({
      status: "INCORRECT",
      evidenceStepIds: ["total"],
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "ARITHMETIC")).toMatchObject({
      status: "DOWNSTREAM_AFFECTED",
    });
  });

  it("rejects a species-swapped partial-pressure dependency with correct arithmetic", () => {
    const attempt = structuredClone(completeHandwritingCorrect.attempt);
    const pressure = attempt.steps.find(({ id }) => id === "pp-n2o4")!;
    const expression = pressure.calculation!.expression;
    if (expression.kind !== "BINARY" || expression.operator !== "MULTIPLY") {
      throw new Error("Expected partial-pressure multiplication");
    }
    const no2Fraction = attempt.steps.find(({ id }) => id === "x-no2")!;
    Object.assign(expression.left, {
      reference: {
        source: "NORMALIZED_STEP_RESULT",
        symbol: "x_NO2",
        stepId: no2Fraction.id,
      },
    });
    Object.assign(pressure.calculation!, {
      declaredResult: {
        value: 300,
        unit: "kPa",
        significantFigures: 3,
        raw: "300 kPa (3 s.f.)",
      },
    });

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({
      decision: "STUDENT_ERROR",
      firstPedagogicalError: "SUBSTITUTION",
      failureCode: "WRONG_DEPENDENCY_USED",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "SUBSTITUTION")).toMatchObject({
      status: "INCORRECT",
      evidenceStepIds: ["pp-n2o4"],
    });
  });

  it("accepts authored ADD and MULTIPLY equations with commuted operands", () => {
    const attempt = structuredClone(completeHandwritingCorrect.attempt);
    for (const stepId of ["total", "pp-n2o4", "pp-no2"]) {
      const expression = attempt.steps.find(({ id }) => id === stepId)!.calculation!.expression;
      if (expression.kind !== "BINARY") throw new Error(`Expected binary equation: ${stepId}`);
      const left = expression.left;
      Object.assign(expression, { left: expression.right, right: left });
    }

    const trace = diagnose(attempt);
    expect(trace).toMatchObject({
      decision: "SOLVED",
      failureCode: null,
      firstPedagogicalError: null,
      attemptSupportOutcome: "SOLVED_INDEPENDENTLY",
    });
    expect(trace.stageEvaluations.find(({ category }) => category === "SUBSTITUTION")).toMatchObject({
      status: "CORRECT",
    });
    expect(trace.deterministicChecks.find(({ category }) => category === "ARITHMETIC")).toMatchObject({
      outcome: "PASS",
    });
  });
});
