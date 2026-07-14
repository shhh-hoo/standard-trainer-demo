import type { ExpectedStepValue, PathFailureCode, StudentStepInput } from "./types";

export const TOOL_VERSIONS = Object.freeze({
  numeric: "numeric-v1.0.0",
  expression: "curated-expression-v1.0.0",
  unit: "unit-v1.0.0",
  significantFigures: "significant-figures-v1.0.0",
});

export interface ToolFailure {
  readonly failureCode: Exclude<PathFailureCode, null>;
  readonly message: string;
  readonly toolVersion: string;
}

function normalizeExpression(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("²", "^2")
    .replace(/\s+/g, "");
}

function normalizeUnit(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function checkNumeric(
  input: StudentStepInput,
  expected: ExpectedStepValue,
): ToolFailure | null {
  if (expected.numericValue === undefined) {
    return null;
  }
  if (typeof input.numericValue !== "number" || !Number.isFinite(input.numericValue)) {
    return {
      failureCode: "NUMERIC_MISMATCH",
      message: "Enter a finite numeric value for this step.",
      toolVersion: TOOL_VERSIONS.numeric,
    };
  }
  const tolerance = expected.absoluteTolerance ?? 1e-9;
  if (Math.abs(input.numericValue - expected.numericValue) > tolerance) {
    return {
      failureCode: "NUMERIC_MISMATCH",
      message: "This numeric value is not the canonical value for this path step.",
      toolVersion: TOOL_VERSIONS.numeric,
    };
  }
  return null;
}

export function checkExpression(
  input: StudentStepInput,
  expected: ExpectedStepValue,
): ToolFailure | null {
  if (!expected.expressionVariants) {
    return null;
  }
  if (
    typeof input.expression !== "string" ||
    !expected.expressionVariants
      .map(normalizeExpression)
      .includes(normalizeExpression(input.expression))
  ) {
    return {
      failureCode: "EXPRESSION_MISMATCH",
      message: "Use the curated Kp expression for the stated equilibrium equation.",
      toolVersion: TOOL_VERSIONS.expression,
    };
  }
  return null;
}

export function checkUnit(
  input: StudentStepInput,
  expected: ExpectedStepValue,
): ToolFailure | null {
  const supplied = normalizeUnit(input.unit ?? "");
  const accepted = expected.acceptedUnits.map(normalizeUnit);
  const valid = accepted.length === 0 ? supplied === "" : accepted.includes(supplied);
  if (!valid) {
    return {
      failureCode: "UNIT_MISMATCH",
      message:
        accepted.length === 0
          ? "This step is dimensionless and should not include a unit."
          : `Use ${expected.acceptedUnits.join(" or ")} for this step.`,
      toolVersion: TOOL_VERSIONS.unit,
    };
  }
  return null;
}

export function checkSignificantFigures(
  input: StudentStepInput,
  expected: ExpectedStepValue,
): ToolFailure | null {
  if (expected.significantFigures === undefined) {
    return null;
  }
  if (input.significantFigures !== expected.significantFigures) {
    return {
      failureCode: "SIGNIFICANT_FIGURES_MISMATCH",
      message: `Report the final value to ${expected.significantFigures} significant figures.`,
      toolVersion: TOOL_VERSIONS.significantFigures,
    };
  }
  return null;
}
