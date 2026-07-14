import { describe, expect, it } from "vitest";
import { evaluateCalculationPath } from "../src/domain/calculationPathEngine";
import type { StudentStepInput } from "../src/domain/types";
import { kpFromEquilibriumMoles } from "../src/fixtures/kpFromEquilibriumMoles";

function canonicalSteps(): Record<string, StudentStepInput> {
  return {
    totalMoles: { numericValue: 1, unit: "mol" },
    moleFractionN2O4: { numericValue: 0.4 },
    moleFractionNO2: { numericValue: 0.6 },
    partialPressureN2O4: { numericValue: 200, unit: "kPa" },
    partialPressureNO2: { numericValue: 300, unit: "kPa" },
    kpExpression: { expression: "p(NO2)^2 / p(N2O4)" },
    kpResult: { numericValue: 450, unit: "kPa", significantFigures: 3 },
  };
}

describe("calculation-path engine", () => {
  it("accepts the canonical structured path for the curated Kp problem", () => {
    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-canonical",
      submittedAt: "2026-07-14T02:00:00.000Z",
      steps: canonicalSteps(),
    });

    expect(trace).toMatchObject({
      decision: "VALID_PATH",
      failureCode: null,
      firstInvalidStepId: null,
      problemDefinitionId: "KP_FROM_EQUILIBRIUM_MOLES",
      problemDefinitionVersion: "1.0.0",
      solutionGraphVersion: "1.0.0",
    });
    expect(trace.stepEvaluations).toHaveLength(7);
    expect(trace.stepEvaluations.every((step) => step.status === "VALID")).toBe(true);
    expect(trace.stepEvaluations[0]?.toolVersions).toEqual(["numeric-v1.0.0", "unit-v1.0.0"]);
    expect(trace.stepEvaluations[5]?.toolVersions).toEqual([
      "curated-expression-v1.0.0",
      "unit-v1.0.0",
    ]);
    expect(trace.stepEvaluations[6]?.toolVersions).toEqual([
      "numeric-v1.0.0",
      "unit-v1.0.0",
      "significant-figures-v1.0.0",
    ]);
  });

  it("accepts Unicode chemical subscripts in the curated Kp expression", () => {
    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-unicode-expression",
      submittedAt: "2026-07-14T04:05:00.000Z",
      steps: {
        ...canonicalSteps(),
        kpExpression: { expression: "p(NO₂)^2/p(N₂O₄)" },
      },
    });

    expect(trace).toMatchObject({
      decision: "VALID_PATH",
      failureCode: null,
      firstInvalidStepId: null,
    });
  });

  it("identifies the first numeric error and does not evaluate later steps", () => {
    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-first-invalid",
      submittedAt: "2026-07-14T02:05:00.000Z",
      steps: {
        ...canonicalSteps(),
        moleFractionN2O4: { numericValue: 0.5 },
      },
    });

    expect(trace).toMatchObject({
      decision: "INVALID_PATH",
      failureCode: "NUMERIC_MISMATCH",
      firstInvalidStepId: "moleFractionN2O4",
    });
    expect(trace.stepEvaluations.map((step) => step.status)).toEqual([
      "VALID",
      "INVALID",
      "NOT_EVALUATED",
      "NOT_EVALUATED",
      "NOT_EVALUATED",
      "NOT_EVALUATED",
      "NOT_EVALUATED",
    ]);
    expect(trace.stepEvaluations[1]?.dependencies).toEqual(["totalMoles"]);
  });

  it("reports an incomplete path when a structured step is missing", () => {
    const steps = canonicalSteps();
    delete steps.totalMoles;

    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-incomplete",
      submittedAt: "2026-07-14T02:10:00.000Z",
      steps,
    });

    expect(trace).toMatchObject({
      decision: "INCOMPLETE_PATH",
      failureCode: "MISSING_STEP",
      firstInvalidStepId: "totalMoles",
    });
  });

  it("rejects a non-canonical Kp expression without invoking a general parser", () => {
    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-expression",
      submittedAt: "2026-07-14T02:15:00.000Z",
      steps: {
        ...canonicalSteps(),
        kpExpression: { expression: "p(N2O4)^2 / p(NO2)" },
      },
    });

    expect(trace).toMatchObject({
      decision: "INVALID_PATH",
      failureCode: "EXPRESSION_MISMATCH",
      firstInvalidStepId: "kpExpression",
    });
    expect(trace.stepEvaluations[5]?.toolVersions).toEqual([
      "curated-expression-v1.0.0",
      "unit-v1.0.0",
    ]);
  });

  it("separates a unit failure from a correct numeric value", () => {
    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-unit",
      submittedAt: "2026-07-14T02:20:00.000Z",
      steps: {
        ...canonicalSteps(),
        totalMoles: { numericValue: 1, unit: "g" },
      },
    });

    expect(trace).toMatchObject({
      decision: "INVALID_PATH",
      failureCode: "UNIT_MISMATCH",
      firstInvalidStepId: "totalMoles",
    });
    expect(trace.stepEvaluations[0]?.toolVersions).toEqual([
      "numeric-v1.0.0",
      "unit-v1.0.0",
    ]);
  });

  it("reports significant figures independently at the final result", () => {
    const trace = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: "attempt-significant-figures",
      submittedAt: "2026-07-14T02:25:00.000Z",
      steps: {
        ...canonicalSteps(),
        kpResult: { numericValue: 450, unit: "kPa", significantFigures: 2 },
      },
    });

    expect(trace).toMatchObject({
      decision: "INVALID_PATH",
      failureCode: "SIGNIFICANT_FIGURES_MISMATCH",
      firstInvalidStepId: "kpResult",
    });
    expect(trace.stepEvaluations[6]?.toolVersions).toEqual([
      "numeric-v1.0.0",
      "unit-v1.0.0",
      "significant-figures-v1.0.0",
    ]);
  });
});
