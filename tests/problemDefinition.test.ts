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
    const steps = kpFromEquilibriumMoles.solutionGraph.steps;
    const definedStepIds = Object.keys(steps);
    expect(order).toHaveLength(7);
    expect(new Set(order).size).toBe(order.length);
    expect(new Set(order)).toEqual(new Set(definedStepIds));

    for (const [index, stepId] of order.entries()) {
      const step = steps[stepId];
      expect(step).toBeDefined();
      expect(step.id).toBe(stepId);
      for (const dependency of step.dependencies) {
        expect(order).toContain(dependency);
        expect(steps[dependency]).toBeDefined();
        expect(order.indexOf(dependency)).toBeLessThan(index);
      }
    }
    expect(steps.kpResult.dependencies).toEqual([
      "partialPressureN2O4",
      "partialPressureNO2",
      "kpExpression",
    ]);
    expect(Object.isFrozen(kpFromEquilibriumMoles)).toBe(true);
    expect(Object.isFrozen(kpFromEquilibriumMoles.solutionGraph)).toBe(true);
  });
});
