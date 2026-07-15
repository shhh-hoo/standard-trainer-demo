import { describe, expect, it } from "vitest";
import {
  compareFormulaAst,
  evaluateExpression,
  expressionsStructurallyEqual,
} from "../src/domain/v2/expressionEvaluator";
import { aggregateRecognitionGate } from "../src/domain/v2/recognitionGate";
import {
  validateDiagnosticProblemDefinitionV2,
  validateNormalizedAttempt,
} from "../src/domain/v2/runtimeValidation";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  completeHandwritingCorrect,
  handwritingRecognitionUncertain,
  kpNormalizedAttemptFixtures,
} from "../src/fixtures/v2/kpNormalizedAttempts";

describe("V2 runtime boundary", () => {
  it("accepts the immutable gold problem and all normalized gold attempts", () => {
    expect(validateDiagnosticProblemDefinitionV2(kpGoldProblemV2)).toEqual({
      ok: true,
      value: kpGoldProblemV2,
    });

    for (const fixture of kpNormalizedAttemptFixtures) {
      expect(validateNormalizedAttempt(fixture.attempt, kpGoldProblemV2), fixture.id).toEqual({
        ok: true,
        value: fixture.attempt,
      });
    }
  });

  it("fails closed with structured paths for invalid versions and references", () => {
    const invalid = structuredClone(completeHandwritingCorrect.attempt);
    Object.assign(invalid, { schemaVersion: "1.0.0" });
    Object.assign(invalid.steps[0]!.source, { artifactId: "missing-artifact" });

    const result = validateNormalizedAttempt(invalid, kpGoldProblemV2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(({ path }) => path)).toEqual(
        expect.arrayContaining(["$.schemaVersion", "$.steps[0].source.artifactId"]),
      );
    }
  });
});

describe("V2 expression evaluator", () => {
  it("evaluates authored facts and prior declared step results without reading display text", () => {
    const expression = completeHandwritingCorrect.attempt.steps[3]!.calculation!.expression;
    const result = evaluateExpression(expression, {
      problem: kpGoldProblemV2,
      declaredStepResults: new Map([["total", 1]]),
      priorStepIds: new Set(["data", "target", "total"]),
    });

    expect(result).toMatchObject({ ok: true, value: 0.4 });
    expect(result.ok && result.usedReferences).toHaveLength(2);
  });

  it("rejects unresolved and unsafe arithmetic and compares AST structure", () => {
    expect(
      evaluateExpression(
        {
          kind: "BINARY",
          operator: "DIVIDE",
          left: { kind: "NUMBER", value: 1, raw: "1" },
          right: { kind: "NUMBER", value: 0, raw: "0" },
        },
        { problem: kpGoldProblemV2 },
      ),
    ).toMatchObject({ ok: false, code: "DIVISION_BY_ZERO" });

    expect(
      expressionsStructurallyEqual(
        kpGoldProblemV2.formulaDefinitions[0]!.expression,
        structuredClone(kpGoldProblemV2.formulaDefinitions[0]!.expression),
      ),
    ).toBe(true);

    const authored = kpGoldProblemV2.formulaDefinitions[0]!.expression;
    if (authored.kind !== "BINARY") throw new Error("Expected authored division");
    expect(
      compareFormulaAst(
        { ...authored, left: authored.right, right: authored.left },
        authored,
      ),
    ).toBe("INVERTED_RELATION");

    const wrongPower = structuredClone(authored);
    if (wrongPower.kind !== "BINARY" || wrongPower.left.kind !== "BINARY") {
      throw new Error("Expected powered numerator");
    }
    Object.assign(wrongPower.left, {
      right: { kind: "NUMBER", value: 1, raw: "1" },
    });
    expect(compareFormulaAst(wrongPower, authored)).toBe("WRONG_STOICHIOMETRIC_POWER");

    const wrongSpecies = structuredClone(authored);
    if (wrongSpecies.kind !== "BINARY" || wrongSpecies.right.kind !== "VARIABLE") {
      throw new Error("Expected denominator species");
    }
    Object.assign(wrongSpecies.right.reference, {
      reasoningNodeId: "partial-pressure-no2",
    });
    expect(compareFormulaAst(wrongSpecies, authored)).toBe("WRONG_SPECIES");
  });
});

describe("V2 recognition gate", () => {
  it("aggregates step, region, and artifact uncertainty before subject diagnosis", () => {
    expect(
      aggregateRecognitionGate(kpGoldProblemV2, completeHandwritingCorrect.attempt).decision,
    ).toBe("PASSED");
    expect(
      aggregateRecognitionGate(kpGoldProblemV2, handwritingRecognitionUncertain.attempt),
    ).toMatchObject({
      decision: "REQUIRES_CONFIRMATION",
      affectedStepIds: ["uncertain-working"],
      affectedCategories: ["STRATEGY", "SUBSTITUTION"],
    });
  });
});
