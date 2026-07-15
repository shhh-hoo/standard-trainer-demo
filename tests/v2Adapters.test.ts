import { describe, expect, it } from "vitest";
import { adaptV1SubmissionToV2 } from "../src/adapters/v2/v1StructuredAdapter";
import { createTypedWorkingMockAttempt } from "../src/adapters/v2/typedWorkingMockAdapter";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import { validateNormalizedAttempt } from "../src/domain/v2/runtimeValidation";
import type { StudentStepInput } from "../src/domain/types";
import { kpFromEquilibriumMoles } from "../src/fixtures/kpFromEquilibriumMoles";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";

const submittedAt = "2026-07-15T02:00:00.000Z";
const context = {
  traceId: "adapter-trace",
  submittedAt,
  interpreter: { kind: "STRUCTURED_ADAPTER" as const, adapterVersion: "v1-structured-v1" },
};

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

function adapt(steps: Record<string, StudentStepInput>) {
  return adaptV1SubmissionToV2(kpFromEquilibriumMoles, {
    attemptId: "v1-adapted",
    submittedAt,
    steps,
  });
}

describe("V1 structured adapter", () => {
  it("adapts the canonical seven-step submission with level-4 provenance", () => {
    const result = adapt(canonicalSteps());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(validateNormalizedAttempt(result.attempt, kpGoldProblemV2).ok).toBe(true);
    expect(result.attempt).toMatchObject({
      learnerMode: "GUIDE_ME",
      modality: "STRUCTURED",
      assistanceEvents: [{ level: 4, hintId: "FULL-SCAFFOLD-KP-01", sequence: 1 }],
      revisions: [{ sequence: 2 }],
    });
    expect(
      result.attempt.assistanceEvents[0]!.sequence < result.attempt.revisions[0]!.sequence,
    ).toBe(true);

    const diagnosis = diagnoseNormalizedAttempt(kpGoldProblemV2, result.attempt, context);
    expect(diagnosis.ok && diagnosis.trace).toMatchObject({
      decision: "SOLVED",
      attemptSupportOutcome: "SOLVED_USING_FULL_SCAFFOLD",
    });
  });

  it("preserves numeric and formula errors as evidence for the engine", () => {
    const firstNumeric = canonicalSteps();
    firstNumeric.totalMoles = { numericValue: 2, unit: "mol" };
    const firstNumericResult = adapt(firstNumeric);
    if (!firstNumericResult.ok) throw new Error(firstNumericResult.message);
    const firstNumericDiagnosis = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      firstNumericResult.attempt,
      context,
    );
    expect(firstNumericDiagnosis.ok && firstNumericDiagnosis.trace).toMatchObject({
      failureCode: "ARITHMETIC_ERROR",
      firstPedagogicalError: "ARITHMETIC",
    });

    const numeric = canonicalSteps();
    numeric.kpResult = { numericValue: 400, unit: "kPa", significantFigures: 3 };
    const numericResult = adapt(numeric);
    if (!numericResult.ok) throw new Error(numericResult.message);
    const numericDiagnosis = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      numericResult.attempt,
      context,
    );
    expect(numericDiagnosis.ok && numericDiagnosis.trace.failureCode).toBe("ARITHMETIC_ERROR");

    const formula = canonicalSteps();
    formula.kpExpression = { expression: "p(N2O4)/p(NO2)^2" };
    const formulaResult = adapt(formula);
    if (!formulaResult.ok) throw new Error(formulaResult.message);
    const formulaDiagnosis = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      formulaResult.attempt,
      context,
    );
    expect(formulaDiagnosis.ok && formulaDiagnosis.trace.failureCode).toBe(
      "INVERTED_RELATION",
    );
  });

  it("keeps incomplete submissions incomplete and rejects unsupported expressions/problems", () => {
    const incomplete = canonicalSteps();
    delete incomplete.kpResult;
    const incompleteResult = adapt(incomplete);
    if (!incompleteResult.ok) throw new Error(incompleteResult.message);
    const diagnosis = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      incompleteResult.attempt,
      context,
    );
    expect(diagnosis.ok && diagnosis.trace.decision).toBe("INCOMPLETE_EVIDENCE");

    const unsupportedExpression = canonicalSteps();
    unsupportedExpression.kpExpression = { expression: "arbitrary learner text" };
    expect(adapt(unsupportedExpression)).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_EXPRESSION",
    });

    expect(
      adaptV1SubmissionToV2(
        { ...kpFromEquilibriumMoles, id: "UNSUPPORTED" as never },
        { attemptId: "x", submittedAt, steps: {} },
      ),
    ).toMatchObject({ ok: false, code: "UNSUPPORTED_PROBLEM" });
  });
});

describe("typed-working mock adapter", () => {
  it("emits valid normalized attempts for four explicit scenarios that the engine diagnoses", () => {
    const expected = {
      COMPRESSED_CORRECT: ["SOLVED", null],
      EXPLANATION_ONLY: ["INCOMPLETE_EVIDENCE", null],
      INVERTED_FORMULA: ["STUDENT_ERROR", "INVERTED_RELATION"],
      WRONG_DEPENDENCY: ["STUDENT_ERROR", "WRONG_DEPENDENCY_USED"],
    } as const;

    for (const [scenario, [decision, failureCode]] of Object.entries(expected)) {
      const attempt = createTypedWorkingMockAttempt(
        scenario as keyof typeof expected,
        `mock-${scenario.toLowerCase()}`,
        submittedAt,
      );
      expect(validateNormalizedAttempt(attempt, kpGoldProblemV2).ok, scenario).toBe(true);
      const result = diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, {
        ...context,
        interpreter: { kind: "TYPED_WORKING_MOCK", adapterVersion: "scenario-v1" },
      });
      expect(result.ok && result.trace, scenario).toMatchObject({ decision, failureCode });
    }
  });
});
