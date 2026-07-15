import { describe, expect, it } from "vitest";
import { adaptV1SubmissionToV2 } from "../src/adapters/v2/v1StructuredAdapter";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import {
  validateDiagnosticEvidenceTraceV2,
  validateDiagnosticProblemDefinitionV2,
  validateNormalizedAttempt,
} from "../src/domain/v2/runtimeValidation";
import type {
  DiagnosticEvidenceTraceV2,
  DiagnosticProblemDefinitionV2,
  NormalizedAttempt,
} from "../src/domain/v2/types";
import { kpFromEquilibriumMoles } from "../src/fixtures/kpFromEquilibriumMoles";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  completeHandwritingCorrect,
  compressedTypedCorrect,
  guidedSolvedAfterFormulaHint,
  handwritingBelowThresholdAbstain,
} from "../src/fixtures/v2/kpNormalizedAttempts";

function expectInvalidAttempt(
  mutate: (attempt: NormalizedAttempt) => void,
  code: string,
  source: NormalizedAttempt = completeHandwritingCorrect.attempt,
) {
  const attempt = structuredClone(source);
  mutate(attempt);
  const result = validateNormalizedAttempt(attempt, kpGoldProblemV2);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.map((item) => item.code)).toContain(code);
}

function expectInvalidProblem(
  mutate: (problem: DiagnosticProblemDefinitionV2) => void,
  code: string,
) {
  const problem = structuredClone(kpGoldProblemV2);
  mutate(problem);
  const result = validateDiagnosticProblemDefinitionV2(problem);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.map((item) => item.code)).toContain(code);
}

function validTrace(): DiagnosticEvidenceTraceV2 {
  const result = diagnoseNormalizedAttempt(
    kpGoldProblemV2,
    completeHandwritingCorrect.attempt,
    {
      traceId: "adversarial-validation-trace",
      submittedAt: "2026-07-15T03:30:00.000Z",
      interpreter: { kind: "STRUCTURED_ADAPTER", adapterVersion: "validation-v1" },
    },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.trace;
}

function expectInvalidTrace(
  mutate: (trace: DiagnosticEvidenceTraceV2) => void,
  code: string,
) {
  const trace = structuredClone(validTrace());
  mutate(trace);
  const result = validateDiagnosticEvidenceTraceV2(trace, kpGoldProblemV2);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.map((item) => item.code)).toContain(code);
}

describe("V2 adversarial runtime validation", () => {
  it("fails closed on attempt enums, quantities, sequences, timestamps, and value metadata", () => {
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.steps[0]!, { semanticType: "BOGUS" }),
      "INVALID_SEMANTIC_TYPE",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.steps[0]!, { concept: "BOGUS" }),
      "INVALID_CONCEPT",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.target!, { quantity: "BOGUS" }),
      "INVALID_TARGET_QUANTITY",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.target!, { explicit: "yes" }),
      "EXPECTED_BOOLEAN",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.factsUsed[0]!, { observedValue: true }),
      "INVALID_OBSERVED_VALUE",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.factsUsed[0]!, { unit: 42 }),
      "EXPECTED_NON_EMPTY_STRING",
    );
    expectInvalidAttempt(
      (attempt) =>
        Object.assign(attempt.steps.at(-1)!.calculation!.declaredResult!, {
          significantFigures: 0,
        }),
      "INVALID_SIGNIFICANT_FIGURES",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.finalAnswer!, { raw: 450, unit: 7 }),
      "EXPECTED_NON_EMPTY_STRING",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.revisions[0]!, { sequence: 0 }),
      "INVALID_SEQUENCE",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.revisions[0]!, { submittedAt: "not-a-date" }),
      "INVALID_TIMESTAMP",
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.assistanceEvents[0]!, { trigger: "BOGUS" }),
      "INVALID_TRIGGER",
      guidedSolvedAfterFormulaHint.attempt,
    );
    expectInvalidAttempt(
      (attempt) => Object.assign(attempt.assistanceEvents[0]!, { level: 5 }),
      "INVALID_LEVEL",
      guidedSolvedAfterFormulaHint.attempt,
    );
  });

  it("enforces authored recognition confidence intervals", () => {
    expectInvalidAttempt(
      (attempt) =>
        Object.assign(attempt.steps[0]!, {
          recognition: {
            status: "REQUIRES_CONFIRMATION",
            confidence: 0.5,
            candidates: [{ transcription: "candidate", confidence: 0.5 }],
          },
        }),
      "RECOGNITION_OUTSIDE_CONFIRMATION_INTERVAL",
      compressedTypedCorrect.attempt,
    );
    expectInvalidAttempt(
      (attempt) =>
        Object.assign(attempt.steps[0]!, {
          recognition: {
            status: "REQUIRES_CONFIRMATION",
            confidence: 0.95,
            candidates: [{ transcription: "candidate", confidence: 0.95 }],
          },
        }),
      "RECOGNITION_OUTSIDE_CONFIRMATION_INTERVAL",
      compressedTypedCorrect.attempt,
    );
    expectInvalidAttempt(
      (attempt) =>
        Object.assign(
          (attempt.recognitionIssues[0] as { recognition: Record<string, unknown> })
            .recognition,
          { confidence: 0.8 },
        ),
      "ABSTENTION_ABOVE_THRESHOLD",
      handwritingBelowThresholdAbstain.attempt,
    );
  });

  it("validates problem evidence enums and uses pedagogical order rather than object order", () => {
    expectInvalidProblem(
      (problem) =>
        Object.assign(problem.reasoningGraph.nodes["total-moles"]!, {
          solutionEvidenceKinds: ["BOGUS"],
        }),
      "INVALID_EVIDENCE_KIND",
    );
    expectInvalidProblem(
      (problem) =>
        Object.assign(problem.reasoningGraph.nodes["total-moles"]!, { concept: "BOGUS" }),
      "INVALID_CONCEPT",
    );
    expectInvalidProblem(
      (problem) =>
        Object.assign(problem.formulaDefinitions[0]!, {
          expression: {
            kind: "VARIABLE",
            reference: {
              source: "NORMALIZED_STEP_RESULT",
              symbol: "step",
              stepId: "some-step",
            },
          },
        }),
      "FORBIDDEN_FORMULA_STEP_REFERENCE",
    );
    expectInvalidProblem(
      (problem) => Object.assign(problem.hintPolicy.hints[0]!, { stage: "BOGUS" }),
      "INVALID_CATEGORY",
    );

    const reordered = structuredClone(kpGoldProblemV2);
    Object.assign(reordered.reasoningGraph, {
      nodes: Object.fromEntries(Object.entries(reordered.reasoningGraph.nodes).reverse()),
    });
    expect(validateDiagnosticProblemDefinitionV2(reordered)).toEqual({
      ok: true,
      value: reordered,
    });
  });

  it("fails closed on trace enums, metadata, sequence, and timestamps", () => {
    expectInvalidTrace(
      (trace) => Object.assign(trace.stageEvaluations[0]!, { status: "BOGUS" }),
      "INVALID_EVALUATION_STATUS",
    );
    expectInvalidTrace(
      (trace) => Object.assign(trace, { decision: "BOGUS" }),
      "INVALID_DIAGNOSIS_DECISION",
    );
    expectInvalidTrace(
      (trace) => Object.assign(trace, { attemptSupportOutcome: "BOGUS" }),
      "INVALID_SUPPORT_OUTCOME",
    );
    expectInvalidTrace(
      (trace) => Object.assign(trace.deterministicChecks[0]!, { outcome: "BOGUS" }),
      "INVALID_CHECK_OUTCOME",
    );
    expectInvalidTrace(
      (trace) => Object.assign(trace.interpreter, { adapterVersion: 42 }),
      "INVALID_INTERPRETER_METADATA",
    );
    expectInvalidTrace(
      (trace) => Object.assign(trace, { submittedAt: "not-a-date" }),
      "INVALID_TIMESTAMP",
    );
    expectInvalidTrace(
      (trace) => Object.assign(trace.revisions[0]!, { sequence: 0 }),
      "INVALID_SEQUENCE",
    );
  });

  it("returns a structured V1 adapter error for an invalid submission timestamp", () => {
    expect(
      adaptV1SubmissionToV2(kpFromEquilibriumMoles, {
        attemptId: "invalid-v1-time",
        submittedAt: "not-a-date",
        steps: {},
      }),
    ).toMatchObject({ ok: false, code: "INVALID_SUBMISSION_TIMESTAMP" });
  });
});
