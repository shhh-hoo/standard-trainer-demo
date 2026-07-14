import { describe, expect, it } from "vitest";
import { judgeAnswer } from "../src/domain/judgement";
import type { ActiveStandard, CurriculumContext } from "../src/domain/types";
import { activeDynamicEquilibriumStandard } from "../src/fixtures/dynamicEquilibriumStandard";
import { legacyDynamicEquilibriumDefinition } from "../src/fixtures/legacyItems";

const curriculum: CurriculumContext = {
  board: "Cambridge International",
  syllabusCode: "9701",
  syllabusCycle: "2025-2027",
};

function judge(answer: string, standard: ActiveStandard | null = activeDynamicEquilibriumStandard) {
  return judgeAnswer({ activeStandard: standard, answer, curriculum });
}

describe("deterministic Dynamic Equilibrium judgement", () => {
  it("passes an answer containing all four draft-rubric elements", () => {
    const result = judge(
      "In a closed system, the forward and reverse reactions continue at equal rates, while concentrations remain constant with time.",
    );

    expect(result.decision).toBe("PASS");
    expect(result.failureCode).toBeNull();
    expect(result.authorityScope).toBe("DRAFT_RUBRIC_ONLY");
    expect(result.satisfiedElementIds).toHaveLength(4);
  });

  it.each([
    [
      "closed_system",
      "The forward and reverse reactions continue at equal rates while concentrations remain constant with time.",
    ],
    [
      "forward_and_reverse_continue",
      "In a closed system, the forward reaction rate equals the reverse reaction rate and concentrations remain constant.",
    ],
    [
      "equal_rates",
      "In a closed system, both reactions continue and concentrations remain constant with time.",
    ],
    [
      "constant_macroscopic_composition",
      "In a closed system, the forward and reverse reactions continue at equal rates.",
    ],
  ])("requires %s", (missingId, answer) => {
    const result = judge(answer);
    expect(result.decision).toBe("REWRITE");
    expect(result.failureCode).toBe("MISSING_REQUIRED_ELEMENT");
    expect(result.missingElementIds).toContain(missingId);
  });

  it.each([
    ["reactions_stop", "In a closed system, the forward and reverse reactions stop and concentrations remain constant."],
    [
      "concentrations_are_equal",
      "In a closed system, both reactions continue at the same rate and concentrations of reactants and products are equal.",
    ],
  ])("blocks dangerous claim %s", (claimId, answer) => {
    const result = judge(answer);
    expect(result.decision).toBe("REWRITE");
    expect(result.failureCode).toBe("DANGEROUS_CLAIM");
    expect(result.dangerousClaimIds).toContain(claimId);
  });

  it("accepts configured alternative wording", () => {
    const result = judge(
      "Inside a sealed vessel, both directions keep occurring at the same rate, so there is no net macroscopic composition change.",
    );
    expect(result.decision).toBe("PASS");
  });

  it("routes the exact frozen legacy answer to review instead of ordinary scoring", () => {
    const result = judge(legacyDynamicEquilibriumDefinition.answer);
    expect(result.decision).toBe("REVIEW");
    expect(result.failureCode).toBe("LEGACY_REFERENCE_CONFLICT");
    expect(result.scoringPerformed).toBe(false);
    expect(result.missingElementIds).toEqual([]);
  });
});

describe("source-policy precedence", () => {
  it("returns unavailable when no Standard Node exists", () => {
    const result = judgeAnswer({ activeStandard: null, answer: "A fluent answer", curriculum });
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.failureCode).toBe("STANDARD_NOT_FOUND");
    expect(result.scoringPerformed).toBe(false);
  });

  it("rejects a wrong board before scoring", () => {
    const result = judgeAnswer({
      activeStandard: activeDynamicEquilibriumStandard,
      answer: "A fluent answer",
      curriculum: { ...curriculum, board: "IB" },
    });
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.failureCode).toBe("WRONG_CURRICULUM");
    expect(result.scoringPerformed).toBe(false);
    expect(result.missingElementIds).toEqual([]);
  });

  it("rejects a stale syllabus cycle before scoring", () => {
    const result = judgeAnswer({
      activeStandard: activeDynamicEquilibriumStandard,
      answer: "A fluent answer",
      curriculum: { ...curriculum, syllabusCycle: "2022-2024" },
    });
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.failureCode).toBe("STALE_STANDARD");
    expect(result.scoringPerformed).toBe(false);
  });

  it("holds a valid-source conflict for review without scoring", () => {
    const conflicted = {
      ...activeDynamicEquilibriumStandard,
      evidence: {
        ...activeDynamicEquilibriumStandard.evidence,
        hasValidSourceConflict: true,
      },
    } satisfies ActiveStandard;
    const result = judge("A fluent answer", conflicted);
    expect(result.decision).toBe("REVIEW");
    expect(result.failureCode).toBe("SOURCE_CONFLICT");
    expect(result.scoringPerformed).toBe(false);
  });

  it("derives authority metadata from the Standard Node, ignoring untrusted extra input", () => {
    const result = judgeAnswer({
      activeStandard: activeDynamicEquilibriumStandard,
      answer:
        "In a closed system, the forward and reverse reactions continue at equal rates while concentrations remain constant.",
      curriculum,
      authorityScope: "EXPERT_REVIEWED",
      sourceStatus: "EXPERT_REVIEWED",
      reviewerStatus: "expert_reviewed",
    } as Parameters<typeof judgeAnswer>[0]);

    expect(result.authorityScope).toBe("DRAFT_RUBRIC_ONLY");
    expect(result.sourceStatus).toBe("AI_DRAFT");
    expect(result.reviewerStatus).toBe("not_reviewed");
  });
});
