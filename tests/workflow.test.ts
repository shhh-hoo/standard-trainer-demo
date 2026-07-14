import { describe, expect, it } from "vitest";
import {
  createWorkflowState,
  revealReference,
  submitFirstAnswer,
  submitRewrite,
  type WorkflowDependencies,
} from "../src/domain/workflow";
import { activeDynamicEquilibriumStandard } from "../src/fixtures/dynamicEquilibriumStandard";
import { legacyDynamicEquilibriumDefinition } from "../src/fixtures/legacyItems";

let idCounter = 0;
const dependencies: WorkflowDependencies = {
  activeStandard: activeDynamicEquilibriumStandard,
  legacyItem: legacyDynamicEquilibriumDefinition,
  curriculum: {
    board: "Cambridge International",
    syllabusCode: "9701",
    syllabusCycle: "2025-2027",
  },
  now: () => "2026-07-14T01:00:00.000Z",
  createId: (kind) => `${kind}-${++idCounter}`,
};

describe("answer and rewrite workflow", () => {
  it("opens rewrite only after a REWRITE decision and stores judgements separately", () => {
    const afterFirst = submitFirstAnswer(
      createWorkflowState(),
      "The forward and reverse reactions continue at equal rates while concentrations remain constant.",
      dependencies,
    );
    expect(afterFirst.phase).toBe("REWRITING");
    expect(afterFirst.attempt?.firstJudgement.decision).toBe("REWRITE");
    expect(afterFirst.attempt?.secondJudgement).toBeNull();

    const afterRewrite = submitRewrite(
      afterFirst,
      "In a closed system, the forward and reverse reactions continue at equal rates while concentrations remain constant.",
      dependencies,
    );
    expect(afterRewrite.phase).toBe("COMPLETE");
    expect(afterRewrite.attempt?.firstJudgement.decision).toBe("REWRITE");
    expect(afterRewrite.attempt?.secondJudgement?.decision).toBe("PASS");
    expect(afterRewrite.attempt?.firstResponse).not.toBe(afterRewrite.attempt?.rewrite);
  });

  it("holds a legacy-reference conflict without opening rewrite", () => {
    const held = submitFirstAnswer(
      createWorkflowState(),
      legacyDynamicEquilibriumDefinition.answer,
      dependencies,
    );
    expect(held.phase).toBe("HELD");
    expect(held.attempt?.status).toBe("HELD");
    expect(held.attempt?.firstJudgement.failureCode).toBe("LEGACY_REFERENCE_CONFLICT");
    expect(() => submitRewrite(held, "A rewrite", dependencies)).toThrow(/only available/i);
  });

  it("holds an unavailable wrong-curriculum attempt without opening rewrite", () => {
    const held = submitFirstAnswer(createWorkflowState(), "A fluent answer", {
      ...dependencies,
      curriculum: { ...dependencies.curriculum, board: "IB" },
    });
    expect(held.phase).toBe("HELD");
    expect(held.attempt?.firstJudgement.decision).toBe("UNAVAILABLE");
    expect(held.attempt?.firstJudgement.scoringPerformed).toBe(false);
    expect(() => submitRewrite(held, "A rewrite", dependencies)).toThrow(/only available/i);
  });

  it("completes an initial PASS without a rewrite", () => {
    const complete = submitFirstAnswer(
      createWorkflowState(),
      "In a closed system, both reactions continue at the same rate and concentrations remain constant.",
      dependencies,
    );
    expect(complete.phase).toBe("COMPLETE");
    expect(complete.attempt?.secondJudgement).toBeNull();
  });

  it("records a reveal without changing either judgement", () => {
    const afterFirst = submitFirstAnswer(
      createWorkflowState(),
      "Both reactions continue.",
      dependencies,
    );
    const revealed = revealReference(afterFirst, () => "2026-07-14T02:00:00.000Z");
    expect(revealed.attempt?.referenceRevealedAt).toBe("2026-07-14T02:00:00.000Z");
    expect(revealed.attempt?.firstJudgement).toBe(afterFirst.attempt?.firstJudgement);
    expect(revealed.attempt?.secondJudgement).toBeNull();
  });
});
