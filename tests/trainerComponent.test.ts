import { describe, expect, it } from "vitest";
import {
  chemistryCalculationTrainer,
  invokeChemistryCalculationTrainerDeveloperScenario,
} from "../src/component/chemistryCalculationTrainer";
import { compressedTypedCorrect } from "../src/fixtures/v2/kpNormalizedAttempts";
import { handwritingRecognitionUncertain } from "../src/fixtures/v2/kpNormalizedAttempts";
import type { StudentStepInput } from "../src/domain/types";

function canonicalLegacySteps(): Record<string, StudentStepInput> {
  return {
    totalMoles: { numericValue: 1, unit: "mol" },
    moleFractionN2O4: { numericValue: 0.4 },
    moleFractionNO2: { numericValue: 0.6 },
    partialPressureN2O4: { numericValue: 200, unit: "kPa" },
    partialPressureNO2: { numericValue: 300, unit: "kPa" },
    kpExpression: { expression: "p(NO2)^2 / p(N2O4)" },
    kpResult: { numericValue: 450, unit: "kPa", significantFigures: 3 },
  };
}

describe("Chemistry Calculation Trainer component boundary", () => {
  it("publishes an honest manifest and exact-matches the supported normalized request", () => {
    expect(chemistryCalculationTrainer.manifest).toMatchObject({
      manifestSchemaVersion: "1.0.0",
      componentId: "chemistry-calculation-trainer",
      componentVersion: "0.2.0",
      componentType: "trainer",
      domain: {
        curriculum: "CAIE 9701 Chemistry",
        topic: "Equilibrium",
        supportedProblemDefinitions: [
          "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        ],
      },
      supportedTasks: ["diagnose-calculation-attempt"],
      operationalInputs: [
        "normalized-attempt",
        "legacy-seven-step-structured-input",
      ],
      executionRequirements: ["normalized-attempt"],
      developerFixtures: [
        "COMPRESSED_CORRECT",
        "EXPLANATION_ONLY",
        "INVERTED_FORMULA",
        "WRONG_DEPENDENCY",
      ],
      contractDependencies: {
        measurementContract: "2.0.0-draft.2",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
      },
      guarantees: {
        diagnosis: "deterministic-for-supported-problem",
        arithmetic: "deterministic",
        problemCoverage: "single-authored-problem",
      },
    });
    expect(chemistryCalculationTrainer.manifest.unsupported).toContain("buffer-calculations");

    expect(
      chemistryCalculationTrainer.preflight({
        task: "diagnose-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "normalized-attempt",
      }),
    ).toEqual({
      coverage: "EXACT_MATCH",
      componentId: "chemistry-calculation-trainer",
      matchDimensions: {
        task: true,
        problemDefinition: true,
        inputReady: true,
      },
      matchedCapabilities: [
        "supported-problem-definition",
        "diagnose-calculation-attempt",
        "normalized-attempt",
      ],
      missingCapabilities: [],
      limitations: ["single-authored-problem", "deterministic-normalized-input-only"],
      recommendedAction: "INVOKE_COMPONENT",
    });
  });

  it("partial-matches supported-problem requests that still require an interpreter", () => {
    for (const [inputKind, missingCapability] of [
      ["handwriting-image", "multimodal-interpreter"],
      ["natural-language-working", "free-text-interpreter"],
      ["digital-ink", "multimodal-interpreter"],
      ["scanned-document", "multimodal-interpreter"],
      ["mixed-working", "multimodal-interpreter"],
    ] as const) {
      expect(
        chemistryCalculationTrainer.preflight({
          task: "diagnose-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind,
        }),
        inputKind,
      ).toEqual({
        coverage: "PARTIAL_MATCH",
        componentId: "chemistry-calculation-trainer",
        matchDimensions: {
          task: true,
          problemDefinition: true,
          inputReady: false,
        },
        matchedCapabilities: [
          "supported-problem-definition",
          "diagnose-calculation-attempt",
          "deterministic-diagnosis",
        ],
        missingCapabilities: [missingCapability, "normalized-attempt"],
        limitations: [
          "single-authored-problem",
          "interpreter-not-included",
          "confirmation-required-before-invocation",
        ],
        recommendedAction: "REQUIRE_INTERPRETER",
      });
    }
  });

  it("rejects unsupported problems, tasks, and developer fixtures without routing policy", () => {
    expect(
      chemistryCalculationTrainer.preflight({
        task: "diagnose-calculation-attempt",
        problemDefinition: "ANOTHER_KP_FROM_EQUILIBRIUM_MOLES@1.0.0",
        inputKind: "normalized-attempt",
      }),
    ).toEqual({
      coverage: "UNSUPPORTED",
      componentId: "chemistry-calculation-trainer",
      matchDimensions: {
        task: true,
        problemDefinition: false,
        inputReady: true,
      },
      matchedCapabilities: [
        "diagnose-calculation-attempt",
        "normalized-attempt",
      ],
      missingCapabilities: ["supported-problem-definition"],
      limitations: ["single-authored-problem", "requested-problem-not-supported"],
      recommendedAction: "DO_NOT_INVOKE",
    });

    expect(
      chemistryCalculationTrainer.preflight({
        task: "explain-equilibrium-concept",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "normalized-attempt",
      }),
    ).toMatchObject({
      coverage: "UNSUPPORTED",
      matchDimensions: {
        task: false,
        problemDefinition: true,
        inputReady: true,
      },
      matchedCapabilities: [
        "supported-problem-definition",
        "normalized-attempt",
      ],
      missingCapabilities: ["supported-task"],
      recommendedAction: "DO_NOT_INVOKE",
    });

    expect(
      chemistryCalculationTrainer.preflight({
        task: "diagnose-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "explicit-mock-scenario",
      }),
    ).toMatchObject({
      coverage: "UNSUPPORTED",
      matchDimensions: {
        task: true,
        problemDefinition: true,
        inputReady: false,
      },
      matchedCapabilities: [
        "supported-problem-definition",
        "diagnose-calculation-attempt",
      ],
      missingCapabilities: ["supported-operational-input"],
      recommendedAction: "DO_NOT_INVOKE",
    });
  });

  it("invokes the deterministic core for an exact normalized attempt", () => {
    const envelope = chemistryCalculationTrainer.invoke({
      request: {
        task: "diagnose-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "normalized-attempt",
      },
      input: {
        kind: "normalized-attempt",
        attempt: compressedTypedCorrect.attempt,
      },
      context: {
        traceId: "component-normalized-trace",
        submittedAt: "2026-07-15T10:00:00.000Z",
        interpreter: {
          kind: "TYPED_WORKING_MOCK",
          adapterVersion: "component-test-v1",
        },
      },
    });

    expect(envelope).toMatchObject({
      componentId: "chemistry-calculation-trainer",
      componentVersion: "0.2.0",
      coverage: "EXACT_MATCH",
      status: "COMPLETED",
      preflight: {
        coverage: "EXACT_MATCH",
        recommendedAction: "INVOKE_COMPONENT",
      },
      limitations: ["single-authored-problem", "deterministic-normalized-input-only"],
      result: {
        decision: "SOLVED",
        problemDefinitionId: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD",
        problemDefinitionVersion: "2.0.0-gold.2",
        submittedAt: "2026-07-15T10:00:00.000Z",
        interpreter: {
          kind: "TYPED_WORKING_MOCK",
          adapterVersion: "component-test-v1",
        },
      },
    });
  });

  it("adapts and invokes the legacy seven-step structured input", () => {
    const envelope = chemistryCalculationTrainer.invoke({
      request: {
        task: "diagnose-calculation-attempt",
        problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
        inputKind: "legacy-seven-step-structured-input",
      },
      input: {
        kind: "legacy-seven-step-structured-input",
        submission: {
          attemptId: "component-legacy-attempt",
          submittedAt: "2026-07-15T10:01:00.000Z",
          steps: canonicalLegacySteps(),
        },
      },
      context: {
        traceId: "component-legacy-trace",
        submittedAt: "2026-07-15T12:00:00.000Z",
        interpreter: { kind: "STRUCTURED_ADAPTER", adapterVersion: "caller-value-ignored" },
      },
    });

    expect(envelope).toMatchObject({
      coverage: "EXACT_MATCH",
      status: "COMPLETED",
      preflight: {
        coverage: "EXACT_MATCH",
        recommendedAction: "INVOKE_COMPONENT",
      },
      result: {
        decision: "SOLVED",
        attemptSupportOutcome: "SOLVED_USING_FULL_SCAFFOLD",
        interpreter: {
          kind: "STRUCTURED_ADAPTER",
          adapterVersion: "v1-structured-v1",
        },
        submittedAt: "2026-07-15T10:01:00.000Z",
      },
    });
  });

  it("runs all four authored fixtures only through the developer scenario API", () => {
    const expected = {
      COMPRESSED_CORRECT: ["SOLVED", null],
      EXPLANATION_ONLY: ["INCOMPLETE_EVIDENCE", null],
      INVERTED_FORMULA: ["STUDENT_ERROR", "INVERTED_RELATION"],
      WRONG_DEPENDENCY: ["STUDENT_ERROR", "WRONG_DEPENDENCY_USED"],
    } as const;

    for (const [scenario, [decision, failureCode]] of Object.entries(expected)) {
      const envelope = invokeChemistryCalculationTrainerDeveloperScenario({
        input: {
          scenario: scenario as keyof typeof expected,
          attemptId: `component-mock-${scenario.toLowerCase()}`,
          submittedAt: "2026-07-15T10:02:00.000Z",
        },
        context: {
          traceId: `component-mock-trace-${scenario.toLowerCase()}`,
          submittedAt: "2026-07-15T12:02:00.000Z",
          interpreter: { kind: "TYPED_WORKING_MOCK", adapterVersion: "caller-value-ignored" },
        },
      });

      expect(envelope, scenario).toMatchObject({
        coverage: "EXACT_MATCH",
        status: "COMPLETED",
        result: {
          decision,
          failureCode,
          interpreter: {
            kind: "TYPED_WORKING_MOCK",
            adapterVersion: "typed-working-mock-v1",
          },
          submittedAt: "2026-07-15T10:02:00.000Z",
        },
      });
    }
  });

  it("preserves recognition and V2 validation details for normalized attempts", () => {
    const request = {
      task: "diagnose-calculation-attempt",
      problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
      inputKind: "normalized-attempt",
    } as const;
    const context = {
      traceId: "component-status-trace",
      submittedAt: "2026-07-15T10:03:00.000Z",
      interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "status-test-v1" },
    };

    expect(
      chemistryCalculationTrainer.invoke({
        request,
        input: {
          kind: "normalized-attempt",
          attempt: handwritingRecognitionUncertain.attempt,
        },
        context,
      }),
    ).toMatchObject({ status: "RECOGNITION_UNCERTAIN", coverage: "EXACT_MATCH" });

    const invalidAttempt = structuredClone(compressedTypedCorrect.attempt);
    Object.assign(invalidAttempt, { problemDefinitionVersion: "unsupported-version" });
    expect(
      chemistryCalculationTrainer.invoke({
        request,
        input: { kind: "normalized-attempt", attempt: invalidAttempt },
        context,
      }),
    ).toMatchObject({
      status: "INVALID_INPUT",
      coverage: "EXACT_MATCH",
      issues: [
        expect.objectContaining({
          path: "$.problemDefinitionVersion",
          code: "WRONG_PROBLEM_VERSION",
        }),
      ],
    });
  });

  it("does not invoke partial, unsupported, or developer-only inputs", () => {
    const context = {
      traceId: "component-not-invoked-trace",
      submittedAt: "2026-07-15T10:04:00.000Z",
      interpreter: { kind: "TYPED_WORKING_MOCK" as const, adapterVersion: "test-v1" },
    };
    expect(
      chemistryCalculationTrainer.invoke({
        request: {
          task: "diagnose-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind: "handwriting-image",
        },
        input: { kind: "handwriting-image" },
        context,
      }),
    ).toMatchObject({
      status: "REQUIRES_INTERPRETER",
      coverage: "PARTIAL_MATCH",
      preflight: {
        recommendedAction: "REQUIRE_INTERPRETER",
        missingCapabilities: ["multimodal-interpreter", "normalized-attempt"],
      },
    });

    expect(
      chemistryCalculationTrainer.invoke({
        request: {
          task: "diagnose-calculation-attempt",
          problemDefinition: "BUFFER_PH_CALCULATION@1.0.0",
          inputKind: "normalized-attempt",
        },
        input: { kind: "normalized-attempt", attempt: compressedTypedCorrect.attempt },
        context,
      }),
    ).toMatchObject({
      status: "NOT_INVOKED_UNSUPPORTED",
      coverage: "UNSUPPORTED",
      preflight: { recommendedAction: "DO_NOT_INVOKE" },
    });

    expect(
      chemistryCalculationTrainer.invoke({
        request: {
          task: "diagnose-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind: "explicit-mock-scenario",
        },
        input: { kind: "explicit-mock-scenario" },
        context,
      }),
    ).toMatchObject({
      status: "NOT_INVOKED_UNSUPPORTED",
      coverage: "UNSUPPORTED",
      preflight: { recommendedAction: "DO_NOT_INVOKE" },
    });
  });

  it("fails closed for malformed public invocation envelopes without throwing", () => {
    expect(chemistryCalculationTrainer.invoke(null)).toMatchObject({
      status: "INVALID_INPUT",
      issues: [expect.objectContaining({ path: "$", code: "INVALID_INVOCATION" })],
    });

    expect(chemistryCalculationTrainer.invoke({})).toMatchObject({
      status: "INVALID_INPUT",
      issues: [expect.objectContaining({ path: "$.request", code: "INVALID_REQUEST" })],
    });

    expect(
      chemistryCalculationTrainer.invoke({
        request: {
          task: "diagnose-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind: "normalized-attempt",
        },
        input: { kind: "normalized-attempt", attempt: compressedTypedCorrect.attempt },
        context: {
          traceId: "",
          submittedAt: "not-a-timestamp",
          interpreter: { kind: "UNDECLARED_INTERPRETER" },
        },
      }),
    ).toMatchObject({
      status: "INVALID_INPUT",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "$.context.traceId", code: "INVALID_TRACE_ID" }),
        expect.objectContaining({
          path: "$.context.submittedAt",
          code: "INVALID_SUBMITTED_AT",
        }),
        expect.objectContaining({
          path: "$.context.interpreter.kind",
          code: "INVALID_INTERPRETER",
        }),
      ]),
    });

    expect(
      chemistryCalculationTrainer.invoke({
        request: {
          task: "diagnose-calculation-attempt",
          problemDefinition: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2",
          inputKind: "normalized-attempt",
        },
        input: { kind: "legacy-seven-step-structured-input" },
        context: {
          traceId: "component-mismatch-trace",
          submittedAt: "2026-07-15T10:05:00.000Z",
          interpreter: { kind: "STRUCTURED_ADAPTER", adapterVersion: "test-v1" },
        },
      }),
    ).toMatchObject({
      status: "INVALID_INPUT",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "$.input.kind",
          code: "INVOCATION_INPUT_MISMATCH",
        }),
      ]),
    });
  });
});
