export type TypedWorkingMockScenario =
  | "COMPRESSED_CORRECT"
  | "EXPLANATION_ONLY"
  | "INVERTED_FORMULA"
  | "WRONG_DEPENDENCY";

export const typedWorkingScenarioDisplay = Object.freeze({
  COMPRESSED_CORRECT:
    "Kp = [(0.600 / 1.000 × 500)²] / [(0.400 / 1.000 × 500)] = 4.50 × 10² kPa",
  EXPLANATION_ONLY:
    "Find Kp using mole fractions, total pressure, partial pressures, and the authored Kp relation.",
  INVERTED_FORMULA: "Kp = p(N₂O₄) / p(NO₂)² = 0.00222 kPa⁻¹",
  WRONG_DEPENDENCY: "Kp = p(NO₂)² / p(N₂O₄) = 0.600² / 0.400 = 0.900",
} satisfies Readonly<Record<TypedWorkingMockScenario, string>>);
