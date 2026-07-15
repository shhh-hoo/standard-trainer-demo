import type {
  CapabilityFitResult,
  ComponentInvocation,
  ComponentManifest,
  ComponentResultEnvelope,
  LearningComponent,
  LearningRequestDescriptor,
} from "./types";
import {
  diagnoseNormalizedAttempt,
  type DiagnosisEngineResult,
} from "../domain/v2/diagnosisEngine";
import { kpGoldProblemV2 } from "../fixtures/v2/kpGoldProblem";
import { adaptV1SubmissionToV2 } from "../adapters/v2/v1StructuredAdapter";
import { kpFromEquilibriumMoles } from "../fixtures/kpFromEquilibriumMoles";
import { createTypedWorkingMockAttempt } from "../adapters/v2/typedWorkingMockAdapter";

export const SUPPORTED_PROBLEM_DEFINITION =
  "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2" as const;
export const DIAGNOSIS_TASK = "diagnose-normalized-calculation-attempt" as const;

const supportedInputs = [
  "normalized-attempt",
  "legacy-seven-step-structured-input",
  "explicit-mock-scenario",
] as const;

const componentLimitations = [
  "single-authored-problem",
  "deterministic-normalized-input-only",
] as const;

export const chemistryCalculationTrainerManifest: ComponentManifest = Object.freeze({
  componentId: "chemistry-calculation-trainer",
  componentVersion: "0.2.0",
  componentType: "trainer",
  domain: Object.freeze({
    curriculum: "CAIE 9701 Chemistry",
    topic: "Equilibrium",
    supportedProblemDefinitions: Object.freeze([SUPPORTED_PROBLEM_DEFINITION]),
  }),
  supportedTasks: Object.freeze([DIAGNOSIS_TASK]),
  supportedInputs: Object.freeze([...supportedInputs]),
  outputs: Object.freeze([
    "stage-diagnosis",
    "first-pedagogical-error",
    "recognition-gate",
    "attempt-support-outcome",
    "evidence-trace",
  ]),
  guarantees: Object.freeze({
    diagnosis: "deterministic-for-supported-problem",
    arithmetic: "deterministic",
    problemCoverage: "single-authored-problem",
  }),
  unsupported: Object.freeze([
    "arbitrary-kp-problems",
    "handwriting-ocr",
    "free-text-parsing",
    "buffer-calculations",
    "kc-calculations",
    "official-exam-grading",
    "transfer-mastery",
  ]),
});

export function preflightChemistryCalculationTrainer(
  request: LearningRequestDescriptor,
): CapabilityFitResult {
  const taskMatches = request.task === DIAGNOSIS_TASK;
  const problemMatches = request.problemDefinition === SUPPORTED_PROBLEM_DEFINITION;
  const inputMatches = supportedInputs.includes(
    request.inputKind as (typeof supportedInputs)[number],
  );
  if (taskMatches && problemMatches && inputMatches) {
    return {
      coverage: "EXACT_MATCH",
      componentId: chemistryCalculationTrainerManifest.componentId,
      fitScore: 1,
      matchedCapabilities: [
        "supported-problem-definition",
        DIAGNOSIS_TASK,
        request.inputKind,
      ],
      missingCapabilities: [],
      limitations: componentLimitations,
      recommendedAction: "INVOKE_COMPONENT",
    };
  }
  const missingInterpreter =
    request.inputKind === "handwriting-image"
      ? "multimodal-interpreter"
      : request.inputKind === "natural-language-working"
        ? "free-text-interpreter"
        : null;
  if (taskMatches && problemMatches && missingInterpreter) {
    return {
      coverage: "PARTIAL_MATCH",
      componentId: chemistryCalculationTrainerManifest.componentId,
      fitScore: 0.65,
      matchedCapabilities: [
        "supported-problem-definition",
        DIAGNOSIS_TASK,
        "deterministic-diagnosis",
      ],
      missingCapabilities: [missingInterpreter, "normalized-attempt"],
      limitations: [
        "single-authored-problem",
        "interpreter-not-included",
        "confirmation-required-before-invocation",
      ],
      recommendedAction: "REQUIRE_INTERPRETER",
    };
  }
  if (taskMatches && !problemMatches) {
    return {
      coverage: "UNSUPPORTED",
      componentId: chemistryCalculationTrainerManifest.componentId,
      fitScore: 0.2,
      matchedCapabilities: [DIAGNOSIS_TASK],
      missingCapabilities: ["supported-problem-definition"],
      limitations: ["single-authored-problem", "requested-problem-not-supported"],
      recommendedAction:
        request.demandSignal === "REPEATED_HIGH_VALUE"
          ? "RECORD_CAPABILITY_GAP"
          : "USE_TEMPORARY_SUPPORT",
    };
  }
  return {
    coverage: "UNSUPPORTED",
    componentId: chemistryCalculationTrainerManifest.componentId,
    fitScore: 0,
    matchedCapabilities: [],
    missingCapabilities: ["supported-request"],
    limitations: componentLimitations,
    recommendedAction:
      request.demandSignal === "REPEATED_HIGH_VALUE"
        ? "RECORD_CAPABILITY_GAP"
        : "USE_TEMPORARY_SUPPORT",
  };
}

function invalidDiagnosisEnvelope(
  coverage: CapabilityFitResult["coverage"],
  limitations: readonly string[],
  issues: readonly { readonly code: string; readonly message: string }[],
): ComponentResultEnvelope {
  return {
    componentId: chemistryCalculationTrainerManifest.componentId,
    componentVersion: chemistryCalculationTrainerManifest.componentVersion,
    coverage,
    status: "INVALID_INPUT",
    limitations,
    issues,
  };
}

function diagnosisEnvelope(
  fit: CapabilityFitResult,
  diagnosis: DiagnosisEngineResult,
): ComponentResultEnvelope {
  if (!diagnosis.ok) {
    return invalidDiagnosisEnvelope(
      fit.coverage,
      fit.limitations,
      diagnosis.issues.map(({ code, message }) => ({ code, message })),
    );
  }
  return {
    componentId: chemistryCalculationTrainerManifest.componentId,
    componentVersion: chemistryCalculationTrainerManifest.componentVersion,
    coverage: fit.coverage,
    status:
      diagnosis.trace.decision === "RECOGNITION_UNCERTAIN"
        ? "RECOGNITION_UNCERTAIN"
        : "COMPLETED",
    result: diagnosis.trace,
    limitations: fit.limitations,
  };
}

export function invokeChemistryCalculationTrainer(
  invocation: ComponentInvocation,
): ComponentResultEnvelope {
  const fit = preflightChemistryCalculationTrainer(invocation.request);
  if (fit.coverage !== "EXACT_MATCH") {
    return {
      componentId: chemistryCalculationTrainerManifest.componentId,
      componentVersion: chemistryCalculationTrainerManifest.componentVersion,
      coverage: fit.coverage,
      status: "UNSUPPORTED",
      limitations: fit.limitations,
      issues: fit.missingCapabilities.map((capability) => ({
        code: "MISSING_CAPABILITY",
        message: capability,
      })),
    };
  }
  if (invocation.request.inputKind !== invocation.input.kind) {
    return invalidDiagnosisEnvelope(fit.coverage, fit.limitations, [
      {
        code: "INVOCATION_INPUT_MISMATCH",
        message: "Invocation input kind must match the preflight request descriptor.",
      },
    ]);
  }
  if (invocation.input.kind === "legacy-seven-step-structured-input") {
    const adapted = adaptV1SubmissionToV2(
      kpFromEquilibriumMoles,
      invocation.input.submission,
    );
    if (!adapted.ok) {
      return invalidDiagnosisEnvelope(fit.coverage, fit.limitations, [
        { code: adapted.code, message: adapted.message },
      ]);
    }
    return diagnosisEnvelope(
      fit,
      diagnoseNormalizedAttempt(kpGoldProblemV2, adapted.attempt, {
        ...invocation.context,
        interpreter: {
          kind: "STRUCTURED_ADAPTER",
          adapterVersion: "v1-structured-v1",
        },
      }),
    );
  }
  if (invocation.input.kind === "explicit-mock-scenario") {
    const attempt = createTypedWorkingMockAttempt(
      invocation.input.scenario,
      invocation.input.attemptId,
      invocation.input.submittedAt,
    );
    return diagnosisEnvelope(
      fit,
      diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, {
        ...invocation.context,
        interpreter: {
          kind: "TYPED_WORKING_MOCK",
          adapterVersion: "typed-working-mock-v1",
        },
      }),
    );
  }
  const diagnosis = diagnoseNormalizedAttempt(
    kpGoldProblemV2,
    invocation.input.attempt,
    invocation.context,
  );
  return diagnosisEnvelope(fit, diagnosis);
}

export const chemistryCalculationTrainer = Object.freeze({
  manifest: chemistryCalculationTrainerManifest,
  preflight: preflightChemistryCalculationTrainer,
  invoke: invokeChemistryCalculationTrainer,
}) satisfies LearningComponent;

export type {
  CapabilityFitResult,
  ComponentInvocation,
  ComponentManifest,
  ComponentResultEnvelope,
  LearningRequestDescriptor,
} from "./types";
