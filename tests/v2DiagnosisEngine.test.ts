import { describe, expect, it } from "vitest";
import { diagnoseNormalizedAttempt } from "../src/domain/v2/diagnosisEngine";
import type { NormalizedAttempt } from "../src/domain/v2/types";
import { kpGoldProblemV2 } from "../src/fixtures/v2/kpGoldProblem";
import {
  compressedTypedCorrect,
  kpNormalizedAttemptFixtures,
} from "../src/fixtures/v2/kpNormalizedAttempts";

const context = {
  traceId: "trace-fixed-pr6",
  submittedAt: "2026-07-15T00:00:00.000Z",
  interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "test-v1" },
};

function diagnosis(attempt: NormalizedAttempt) {
  const result = diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.trace;
}

function diagnosticProjection(trace: ReturnType<typeof diagnosis>) {
  return {
    recognitionGateDecision: trace.recognitionGateDecision,
    decision: trace.decision,
    failureCode: trace.failureCode,
    firstPedagogicalError: trace.firstPedagogicalError,
    attemptSupportOutcome: trace.attemptSupportOutcome,
    stageEvaluations: trace.stageEvaluations,
  };
}

function semanticProjection(trace: ReturnType<typeof diagnosis>) {
  const projected = diagnosticProjection(trace);
  return {
    ...projected,
    stageEvaluations: projected.stageEvaluations.map(
      ({ evidenceStepIds: _evidenceStepIds, ...stage }) => stage,
    ),
  };
}

describe("V2 deterministic diagnosis engine", () => {
  it("exactly matches all 16 authored gold diagnoses through the real public API", () => {
    for (const fixture of kpNormalizedAttemptFixtures) {
      expect(diagnosticProjection(diagnosis(fixture.attempt)), fixture.id).toEqual(
        fixture.expected,
      );
    }
  });

  it("does not branch on fixture metadata, raw transcription, content references, or display text", () => {
    const original = semanticProjection(diagnosis(compressedTypedCorrect.attempt));
    const changed = structuredClone(compressedTypedCorrect.attempt);
    Object.assign(changed, { attemptId: "renamed-attempt" });
    Object.assign(changed.artifacts[0]!, { id: "renamed-artifact", contentRef: "elsewhere://opaque" });
    Object.assign(changed.steps[0]!.source, {
      artifactId: "renamed-artifact",
      textSpan: "unrelated display span",
    });
    Object.assign(changed.steps[0]!, { id: "renamed-step", rawTranscription: "nonsense" });
    Object.assign(changed.revisions[0]!, { id: "renamed-revision", stepIds: ["renamed-step"] });
    Object.assign(changed.steps[0]!, { revisionId: "renamed-revision" });
    changed.factsUsed.forEach((factUse) =>
      Object.assign(factUse, { evidenceStepIds: ["renamed-step"] }),
    );
    Object.assign(changed.target!, { evidenceStepIds: ["renamed-step"] });

    expect(semanticProjection(diagnosis(changed))).toEqual(original);
  });

  it("changes diagnosis when a required AST dependency or recognition union changes", () => {
    const dependencyChanged = structuredClone(compressedTypedCorrect.attempt);
    const expression = dependencyChanged.steps[0]!.calculation!.expression;
    if (expression.kind !== "BINARY") throw new Error("Expected compressed division");
    const numerator = expression.left;
    if (numerator.kind !== "BINARY" || numerator.operator !== "POWER") {
      throw new Error("Expected powered numerator");
    }
    const pressure = numerator.left;
    if (pressure.kind !== "BINARY") throw new Error("Expected partial pressure");
    Object.assign(pressure, {
      right: {
        kind: "VARIABLE",
        reference: {
          source: "AUTHORED_FACT",
          symbol: "V",
          factId: "vessel-volume",
        },
      },
    });
    expect(diagnosticProjection(diagnosis(dependencyChanged))).not.toEqual(
      diagnosticProjection(diagnosis(compressedTypedCorrect.attempt)),
    );

    const recognitionChanged = structuredClone(compressedTypedCorrect.attempt);
    Object.assign(recognitionChanged.steps[0]!, {
      recognition: {
        status: "REQUIRES_CONFIRMATION",
        confidence: 0.8,
        candidates: [{ transcription: "candidate", confidence: 0.8 }],
      },
    });
    expect(diagnosis(recognitionChanged).recognitionGateDecision).toBe(
      "REQUIRES_CONFIRMATION",
    );
  });
});

describe("V2 production boundary", () => {
  it("does not import fixture expected labels into domain or adapters", async () => {
    const modules = import.meta.glob("../src/{domain,adapters}/**/*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    expect(Object.values(modules).join("\n")).not.toContain("kpNormalizedAttempts");
  });
});
