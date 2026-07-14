import type { ProblemDefinition } from "../domain/types";

export const kpFromEquilibriumMoles = Object.freeze<ProblemDefinition>({
  schemaVersion: "1.0.0",
  id: "KP_FROM_EQUILIBRIUM_MOLES",
  version: "1.0.0",
  title: "Kp from equilibrium moles",
  reaction: "N₂O₄(g) ⇌ 2NO₂(g)",
  prompt:
    "At equilibrium, a 2.00 dm³ vessel contains 0.400 mol N₂O₄ and 0.600 mol NO₂. The total pressure is 500 kPa. Calculate Kp using the structured path.",
  givens: Object.freeze([
    Object.freeze({ label: "n(N₂O₄)", value: "0.400 mol" }),
    Object.freeze({ label: "n(NO₂)", value: "0.600 mol" }),
    Object.freeze({ label: "Total pressure", value: "500 kPa" }),
    Object.freeze({ label: "Required precision", value: "3 significant figures" }),
  ]),
  solutionGraph: Object.freeze({
    version: "1.0.0",
    orderedStepIds: Object.freeze([
      "totalMoles",
      "moleFractionN2O4",
      "moleFractionNO2",
      "partialPressureN2O4",
      "partialPressureNO2",
      "kpExpression",
      "kpResult",
    ]),
    steps: Object.freeze({
      totalMoles: Object.freeze({
        id: "totalMoles",
        label: "Total equilibrium moles",
        instruction: "Add the equilibrium amounts of both gases.",
        dependencies: Object.freeze([]),
        expected: Object.freeze({
          numericValue: 1,
          absoluteTolerance: 1e-9,
          acceptedUnits: Object.freeze(["mol"]),
        }),
      }),
      moleFractionN2O4: Object.freeze({
        id: "moleFractionN2O4",
        label: "Mole fraction of N₂O₄",
        instruction: "Divide n(N₂O₄) by total equilibrium moles.",
        dependencies: Object.freeze(["totalMoles"]),
        expected: Object.freeze({
          numericValue: 0.4,
          absoluteTolerance: 1e-9,
          acceptedUnits: Object.freeze([]),
        }),
      }),
      moleFractionNO2: Object.freeze({
        id: "moleFractionNO2",
        label: "Mole fraction of NO₂",
        instruction: "Divide n(NO₂) by total equilibrium moles.",
        dependencies: Object.freeze(["totalMoles"]),
        expected: Object.freeze({
          numericValue: 0.6,
          absoluteTolerance: 1e-9,
          acceptedUnits: Object.freeze([]),
        }),
      }),
      partialPressureN2O4: Object.freeze({
        id: "partialPressureN2O4",
        label: "Partial pressure of N₂O₄",
        instruction: "Multiply its mole fraction by the total pressure.",
        dependencies: Object.freeze(["moleFractionN2O4"]),
        expected: Object.freeze({
          numericValue: 200,
          absoluteTolerance: 1e-9,
          acceptedUnits: Object.freeze(["kPa"]),
        }),
      }),
      partialPressureNO2: Object.freeze({
        id: "partialPressureNO2",
        label: "Partial pressure of NO₂",
        instruction: "Multiply its mole fraction by the total pressure.",
        dependencies: Object.freeze(["moleFractionNO2"]),
        expected: Object.freeze({
          numericValue: 300,
          absoluteTolerance: 1e-9,
          acceptedUnits: Object.freeze(["kPa"]),
        }),
      }),
      kpExpression: Object.freeze({
        id: "kpExpression",
        label: "Kp expression",
        instruction: "Write Kp using the partial pressures and stoichiometric powers.",
        dependencies: Object.freeze([]),
        expected: Object.freeze({
          expressionVariants: Object.freeze([
            "p(NO2)^2/p(N2O4)",
            "(p(NO2)^2)/p(N2O4)",
            "p_NO2^2/p_N2O4",
          ]),
          acceptedUnits: Object.freeze([]),
        }),
      }),
      kpResult: Object.freeze({
        id: "kpResult",
        label: "Kp result",
        instruction: "Substitute the partial pressures and report the final Kp.",
        dependencies: Object.freeze([
          "partialPressureN2O4",
          "partialPressureNO2",
          "kpExpression",
        ]),
        expected: Object.freeze({
          numericValue: 450,
          absoluteTolerance: 1e-9,
          acceptedUnits: Object.freeze(["kPa"]),
          significantFigures: 3,
        }),
      }),
    }),
  }),
});
