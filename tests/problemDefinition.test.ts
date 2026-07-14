import { describe, expect, it } from "vitest";
import { kpFromEquilibriumMoles } from "../src/fixtures/kpFromEquilibriumMoles";

describe("curated problem definition", () => {
  it("pins one versioned problem to an explicit acyclic solution graph", () => {
    expect(kpFromEquilibriumMoles).toMatchObject({
      schemaVersion: "1.0.0",
      id: "KP_FROM_EQUILIBRIUM_MOLES",
      version: "1.0.0",
      solutionGraph: { version: "1.0.0" },
    });

    const order = kpFromEquilibriumMoles.solutionGraph.orderedStepIds;
    expect(order).toHaveLength(7);
    expect(new Set(order).size).toBe(order.length);
    for (const [index, stepId] of order.entries()) {
      const step = kpFromEquilibriumMoles.solutionGraph.steps[stepId];
      expect(step.id).toBe(stepId);
      expect(step.dependencies.every((dependency) => order.indexOf(dependency) < index)).toBe(true);
    }
    expect(kpFromEquilibriumMoles.solutionGraph.steps.kpResult.dependencies).toEqual([
      "partialPressureN2O4",
      "partialPressureNO2",
      "kpExpression",
    ]);
    expect(Object.isFrozen(kpFromEquilibriumMoles)).toBe(true);
    expect(Object.isFrozen(kpFromEquilibriumMoles.solutionGraph)).toBe(true);
  });
});
