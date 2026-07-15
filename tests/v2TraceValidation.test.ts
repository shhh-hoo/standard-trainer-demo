import { describe, expect, it } from "vitest";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import {
  validateDiagnosticEvidenceTraceV2,
  validateDiagnosticProblemDefinitionV2,
  validateNormalizedAttempt,
} from "../src/domain/v2/runtimeValidation";
import type { NormalizedAttempt } from "../src/domain/v2/types";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  completeHandwritingCorrect,
  guidedSolvedAfterFormulaHint,
  handwritingBelowThresholdAbstain,
} from "../src/fixtures/v2/kpNormalizedAttempts";

function cloneAttempt(attempt: NormalizedAttempt) {
  return structuredClone(attempt);
}

function expectInvalidAttempt(attempt: NormalizedAttempt, code: string) {
  const result = validateNormalizedAttempt(attempt, kpGoldProblemV2);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.map((item) => item.code)).toContain(code);
}

const context = {
  traceId: "trace-validation",
  submittedAt: "2026-07-15T01:00:00.000Z",
  interpreter: { kind: "STRUCTURED_ADAPTER" as const, adapterVersion: "validation-test" },
};

describe("V2 deliberate malformed runtime corpus", () => {
  it("rejects a wrong contract version in the problem definition", () => {
    const problem = structuredClone(kpGoldProblemV2);
    Object.assign(problem, { schemaVersion: "2.0.0-draft.1" });
    const result = validateDiagnosticProblemDefinitionV2(problem);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map(({ code }) => code)).toContain(
      "WRONG_CONTRACT_VERSION",
    );
  });

  it("rejects missing artifacts, source mismatches, invalid boxes, and duplicate step IDs", () => {
    const missing = cloneAttempt(completeHandwritingCorrect.attempt);
    Object.assign(missing.steps[0]!.source, { artifactId: "missing" });
    expectInvalidAttempt(missing, "MISSING_ARTIFACT");

    const mismatch = cloneAttempt(completeHandwritingCorrect.attempt);
    Object.assign(mismatch.steps[0]!.source, { modality: "DIGITAL_INK" });
    expectInvalidAttempt(mismatch, "SOURCE_MODALITY_MISMATCH");

    const box = cloneAttempt(completeHandwritingCorrect.attempt);
    const source = box.steps[0]!.source;
    if (!("boundingBox" in source)) throw new Error("Expected visual source");
    Object.assign(source.boundingBox, { x: 0.8, width: 0.4 });
    expectInvalidAttempt(box, "INVALID_BOUNDING_BOX");

    const duplicate = cloneAttempt(completeHandwritingCorrect.attempt);
    Object.assign(duplicate.steps[1]!, { id: duplicate.steps[0]!.id });
    expectInvalidAttempt(duplicate, "DUPLICATE_ID_OR_SEQUENCE");
  });

  it("rejects duplicate sequences and unresolved fact, node, and prior-step references", () => {
    const sequence = cloneAttempt(guidedSolvedAfterFormulaHint.attempt);
    Object.assign(sequence.revisions[1]!, { sequence: sequence.revisions[0]!.sequence });
    expectInvalidAttempt(sequence, "DUPLICATE_ID_OR_SEQUENCE");

    const fact = cloneAttempt(completeHandwritingCorrect.attempt);
    const expression = fact.steps[2]!.calculation!.expression;
    if (expression.kind !== "BINARY" || expression.left.kind !== "VARIABLE") {
      throw new Error("Expected fact expression");
    }
    Object.assign(expression.left.reference, { factId: "missing-fact" });
    expectInvalidAttempt(fact, "UNRESOLVED_FACT");

    const node = cloneAttempt(completeHandwritingCorrect.attempt);
    const target = node.steps[2]!.calculation!.target;
    Object.assign(target, { reasoningNodeId: "missing-node" });
    expectInvalidAttempt(node, "UNRESOLVED_REASONING_NODE");

    const forward = cloneAttempt(completeHandwritingCorrect.attempt);
    const totalExpression = forward.steps[2]!.calculation!.expression;
    if (totalExpression.kind !== "BINARY") throw new Error("Expected binary total");
    Object.assign(totalExpression, {
      left: {
        kind: "VARIABLE",
        reference: {
          source: "NORMALIZED_STEP_RESULT",
          symbol: "future",
          stepId: "final",
        },
      },
    });
    expectInvalidAttempt(forward, "FORWARD_STEP_REFERENCE");
  });

  it("rejects invalid assistance ordering/references and below-threshold auto acceptance", () => {
    const after = cloneAttempt(guidedSolvedAfterFormulaHint.attempt);
    Object.assign(after.assistanceEvents[0]!, { sequence: 4 });
    expectInvalidAttempt(after, "ASSISTANCE_AFTER_REVISION");

    const missing = cloneAttempt(guidedSolvedAfterFormulaHint.attempt);
    Object.assign(missing.revisions[1]!, {
      precededByAssistanceEventIds: ["missing-assistance"],
    });
    expectInvalidAttempt(missing, "UNRESOLVED_ASSISTANCE");

    const confidence = cloneAttempt(completeHandwritingCorrect.attempt);
    Object.assign(confidence.steps[0]!.recognition, { confidence: 0.8 });
    expectInvalidAttempt(confidence, "AUTO_ACCEPT_BELOW_THRESHOLD");
  });

  it("rejects significant-figure claims without matching source/raw evidence", () => {
    const attempt = cloneAttempt(completeHandwritingCorrect.attempt);
    Object.assign(attempt.finalAnswer!, { raw: undefined });
    expectInvalidAttempt(attempt, "MISSING_FINAL_SOURCE_EVIDENCE");
  });
});

describe("V2 trace consistency boundary", () => {
  it("rejects unresolved recognition that claims PASSED", () => {
    const result = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      handwritingBelowThresholdAbstain.attempt,
      context,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const trace = structuredClone(result.trace);
    Object.assign(trace, {
      recognitionGateDecision: "PASSED",
      decision: "INCOMPLETE_EVIDENCE",
    });
    const validation = validateDiagnosticEvidenceTraceV2(trace, kpGoldProblemV2);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.issues.map(({ code }) => code)).toContain(
      "UNRESOLVED_RECOGNITION_PASSED",
    );
  });

  it("rejects invalid stage/failure pairings and an invalid first error", () => {
    const result = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      completeHandwritingCorrect.attempt,
      context,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    const pairing = structuredClone(result.trace);
    Object.assign(pairing.stageEvaluations[0]!, {
      status: "INCORRECT",
      failureCode: "UNIT_ERROR",
    });
    const pairingResult = validateDiagnosticEvidenceTraceV2(pairing, kpGoldProblemV2);
    expect(pairingResult.ok).toBe(false);
    if (!pairingResult.ok) expect(pairingResult.issues.map(({ code }) => code)).toContain(
      "INVALID_STAGE_FAILURE_PAIR",
    );

    const first = structuredClone(result.trace);
    Object.assign(first, {
      firstPedagogicalError: "FORMULA",
      failureCode: "WRONG_FORMULA",
    });
    const firstResult = validateDiagnosticEvidenceTraceV2(first, kpGoldProblemV2);
    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) expect(firstResult.issues.map(({ code }) => code)).toContain(
      "INVALID_FIRST_ERROR",
    );
  });

  it("rejects support outcomes that disagree with the decision revision", () => {
    const hinted = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      guidedSolvedAfterFormulaHint.attempt,
      context,
    );
    if (!hinted.ok) throw new Error(JSON.stringify(hinted.issues));
    const falseIndependent = structuredClone(hinted.trace);
    Object.assign(falseIndependent, { attemptSupportOutcome: "SOLVED_INDEPENDENTLY" });
    const falseIndependentResult = validateDiagnosticEvidenceTraceV2(
      falseIndependent,
      kpGoldProblemV2,
    );
    expect(falseIndependentResult.ok).toBe(false);
    if (!falseIndependentResult.ok) {
      expect(falseIndependentResult.issues.map(({ code }) => code)).toContain(
        "INDEPENDENT_OUTCOME_WITH_LINKED_ASSISTANCE",
      );
    }

    const independent = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      completeHandwritingCorrect.attempt,
      context,
    );
    if (!independent.ok) throw new Error(JSON.stringify(independent.issues));
    const missingFormulaHint = structuredClone(independent.trace);
    Object.assign(missingFormulaHint, {
      attemptSupportOutcome: "SOLVED_AFTER_FORMULA_HINT",
    });
    const missingFormulaHintResult = validateDiagnosticEvidenceTraceV2(
      missingFormulaHint,
      kpGoldProblemV2,
    );
    expect(missingFormulaHintResult.ok).toBe(false);
    if (!missingFormulaHintResult.ok) {
      expect(missingFormulaHintResult.issues.map(({ code }) => code)).toContain(
        "SUPPORT_OUTCOME_WITHOUT_DIRECT_EVENT",
      );
    }
  });

  it("rejects unsupported-by-causality stages and unsatisfied solved traces", () => {
    const result = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      completeHandwritingCorrect.attempt,
      context,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    const unsupported = structuredClone(result.trace);
    Object.assign(
      unsupported.stageEvaluations.find(({ category }) => category === "FORMULA")!,
      { status: "SUPPORTED_BY_HINT" },
    );
    const unsupportedResult = validateDiagnosticEvidenceTraceV2(unsupported, kpGoldProblemV2);
    expect(unsupportedResult.ok).toBe(false);
    if (!unsupportedResult.ok) {
      expect(unsupportedResult.issues.map(({ code }) => code)).toContain(
        "SUPPORTED_STAGE_WITHOUT_DIRECT_EVENT",
      );
    }

    const unsatisfied = structuredClone(result.trace);
    Object.assign(
      unsatisfied.stageEvaluations.find(({ category }) => category === "FORMULA")!,
      { status: "NOT_OBSERVED", evidenceStepIds: [] },
    );
    const unsatisfiedResult = validateDiagnosticEvidenceTraceV2(unsatisfied, kpGoldProblemV2);
    expect(unsatisfiedResult.ok).toBe(false);
    if (!unsatisfiedResult.ok) {
      expect(unsatisfiedResult.issues.map(({ code }) => code)).toContain(
        "SOLVED_WITHOUT_REQUIRED_STAGE",
      );
    }
  });

  it("uses internal context to require an accepted strategy and semantic equations", () => {
    const result = diagnoseNormalizedAttempt(
      kpGoldProblemV2,
      completeHandwritingCorrect.attempt,
      context,
    );
    if (!result.ok) throw new Error(JSON.stringify(result.issues));

    const noStrategy = validateDiagnosticEvidenceTraceV2(result.trace, kpGoldProblemV2, {
      attempt: completeHandwritingCorrect.attempt,
      selectedStrategyId: null,
      decisionRevisionId: "rev-1",
    });
    expect(noStrategy.ok).toBe(false);
    if (!noStrategy.ok) {
      expect(noStrategy.issues.map(({ code }) => code)).toContain(
        "SOLVED_WITHOUT_ACCEPTED_STRATEGY",
      );
    }

    const wrongEquation = cloneAttempt(completeHandwritingCorrect.attempt);
    const total = wrongEquation.steps.find(({ id }) => id === "total")!;
    const expression = total.calculation!.expression;
    if (expression.kind !== "BINARY" || expression.operator !== "ADD") {
      throw new Error("Expected total-moles addition");
    }
    Object.assign(expression, { right: structuredClone(expression.left) });
    const semanticMismatch = validateDiagnosticEvidenceTraceV2(
      result.trace,
      kpGoldProblemV2,
      {
        attempt: wrongEquation,
        selectedStrategyId: "EXPLICIT_PARTIAL_PRESSURES",
        decisionRevisionId: "rev-1",
      },
    );
    expect(semanticMismatch.ok).toBe(false);
    if (!semanticMismatch.ok) {
      expect(semanticMismatch.issues.map(({ code }) => code)).toContain(
        "SEMANTIC_EQUATION_FAILURE_WITH_STRATEGY_MATCH",
      );
    }
  });
});
