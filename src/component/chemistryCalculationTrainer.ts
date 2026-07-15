import type {
  CapabilityFitResult,
  ComponentIssue,
  ComponentManifest,
  ComponentResultEnvelope,
  LearningComponent,
  LearningRequestDescriptor,
  TrainerDeveloperScenarioInvocation,
} from "./types";
import {
  diagnoseNormalizedAttempt,
  type DiagnosisContext,
  type DiagnosisEngineResult,
} from "../domain/v2/diagnosisEngine";
import type { CalculationPathSubmission } from "../domain/types";
import { V2_CONTRACT_VERSION } from "../domain/v2/types";
import { kpGoldProblemV2 } from "../fixtures/v2/kpGoldProblem";
import { adaptV1SubmissionToV2 } from "../adapters/v2/v1StructuredAdapter";
import { kpFromEquilibriumMoles } from "../fixtures/kpFromEquilibriumMoles";
import { createTypedWorkingMockAttempt } from "../adapters/v2/typedWorkingMockAdapter";

export const SUPPORTED_PROBLEM_DEFINITION =
  "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2" as const;
export const DIAGNOSIS_TASK = "diagnose-calculation-attempt" as const;

const operationalInputs = [
  "normalized-attempt",
  "legacy-seven-step-structured-input",
] as const;

const interpreterRequiredInputs: Readonly<Record<string, string>> = Object.freeze({
  "natural-language-working": "free-text-interpreter",
  "handwriting-image": "multimodal-interpreter",
  "digital-ink": "multimodal-interpreter",
  "scanned-document": "multimodal-interpreter",
  "mixed-working": "multimodal-interpreter",
});

const developerFixtures = [
  "COMPRESSED_CORRECT",
  "EXPLANATION_ONLY",
  "INVERTED_FORMULA",
  "WRONG_DEPENDENCY",
] as const;

const componentLimitations = [
  "single-authored-problem",
  "deterministic-normalized-input-only",
] as const;

type UnknownRecord = Record<string, unknown>;

const interpreterKinds = new Set([
  "STRUCTURED_ADAPTER",
  "TYPED_WORKING_MOCK",
  "MULTIMODAL_MODEL",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function invalidInvocationFit(): CapabilityFitResult {
  return {
    coverage: "UNSUPPORTED",
    componentId: chemistryCalculationTrainerManifest.componentId,
    matchDimensions: {
      task: false,
      problemDefinition: false,
      inputReady: false,
    },
    matchedCapabilities: [],
    missingCapabilities: ["valid-component-invocation"],
    limitations: ["invalid-component-invocation"],
    recommendedAction: "DO_NOT_INVOKE",
  };
}

function validateContext(value: unknown, issues: ComponentIssue[]): DiagnosisContext | null {
  if (!isRecord(value)) {
    issues.push({
      path: "$.context",
      code: "INVALID_CONTEXT",
      message: "Invocation context must be an object.",
    });
    return null;
  }
  if (typeof value.traceId !== "string" || value.traceId.trim() === "") {
    issues.push({
      path: "$.context.traceId",
      code: "INVALID_TRACE_ID",
      message: "Trace ID must be a non-empty string.",
    });
  }
  if (!isIsoUtcTimestamp(value.submittedAt)) {
    issues.push({
      path: "$.context.submittedAt",
      code: "INVALID_SUBMITTED_AT",
      message: "Context submittedAt must be a valid ISO-8601 UTC timestamp.",
    });
  }
  const interpreter = value.interpreter;
  if (!isRecord(interpreter)) {
    issues.push({
      path: "$.context.interpreter",
      code: "INVALID_INTERPRETER",
      message: "Interpreter metadata must be an object.",
    });
  } else {
    if (!interpreterKinds.has(String(interpreter.kind))) {
      issues.push({
        path: "$.context.interpreter.kind",
        code: "INVALID_INTERPRETER",
        message: "Interpreter kind is not supported by the V2 contract.",
      });
    }
    for (const field of ["adapterVersion", "modelVersion", "promptVersion"] as const) {
      if (interpreter[field] !== undefined && typeof interpreter[field] !== "string") {
        issues.push({
          path: `$.context.interpreter.${field}`,
          code: "INVALID_INTERPRETER_METADATA",
          message: "Interpreter version metadata must be a string.",
        });
      }
    }
  }
  if (issues.length > 0 || !isRecord(interpreter)) return null;
  return value as unknown as DiagnosisContext;
}

export const chemistryCalculationTrainerManifest: ComponentManifest = Object.freeze({
  manifestSchemaVersion: "1.0.0",
  componentId: "chemistry-calculation-trainer",
  componentVersion: "0.2.0",
  componentType: "trainer",
  domain: Object.freeze({
    curriculum: "CAIE 9701 Chemistry",
    topic: "Equilibrium",
    supportedProblemDefinitions: Object.freeze([SUPPORTED_PROBLEM_DEFINITION]),
  }),
  supportedTasks: Object.freeze([DIAGNOSIS_TASK]),
  operationalInputs: Object.freeze([...operationalInputs]),
  executionRequirements: Object.freeze(["normalized-attempt"]),
  developerFixtures: Object.freeze([...developerFixtures]),
  contractDependencies: Object.freeze({
    measurementContract: V2_CONTRACT_VERSION,
    problemDefinition: SUPPORTED_PROBLEM_DEFINITION,
  }),
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
  const inputMatches = operationalInputs.includes(
    request.inputKind as (typeof operationalInputs)[number],
  );
  if (taskMatches && problemMatches && inputMatches) {
    return {
      coverage: "EXACT_MATCH",
      componentId: chemistryCalculationTrainerManifest.componentId,
      matchDimensions: {
        task: true,
        problemDefinition: true,
        inputReady: true,
      },
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
  const missingInterpreter = interpreterRequiredInputs[request.inputKind] ?? null;
  if (taskMatches && problemMatches && missingInterpreter) {
    return {
      coverage: "PARTIAL_MATCH",
      componentId: chemistryCalculationTrainerManifest.componentId,
      matchDimensions: {
        task: true,
        problemDefinition: true,
        inputReady: false,
      },
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
      matchDimensions: {
        task: true,
        problemDefinition: false,
        inputReady: inputMatches,
      },
      matchedCapabilities: [
        DIAGNOSIS_TASK,
        ...(inputMatches ? [request.inputKind] : []),
      ],
      missingCapabilities: ["supported-problem-definition"],
      limitations: ["single-authored-problem", "requested-problem-not-supported"],
      recommendedAction: "DO_NOT_INVOKE",
    };
  }
  const matchedCapabilities = [
    ...(problemMatches ? ["supported-problem-definition"] : []),
    ...(taskMatches ? [DIAGNOSIS_TASK] : []),
    ...(inputMatches ? [request.inputKind] : []),
  ];
  const missingCapabilities = [
    ...(!taskMatches ? ["supported-task"] : []),
    ...(!problemMatches ? ["supported-problem-definition"] : []),
    ...(!inputMatches ? ["supported-operational-input"] : []),
  ];
  return {
    coverage: "UNSUPPORTED",
    componentId: chemistryCalculationTrainerManifest.componentId,
    matchDimensions: {
      task: taskMatches,
      problemDefinition: problemMatches,
      inputReady: inputMatches,
    },
    matchedCapabilities,
    missingCapabilities,
    limitations: [
      ...componentLimitations,
      ...(!taskMatches ? ["requested-task-not-supported"] : []),
      ...(!inputMatches ? ["requested-input-not-operational"] : []),
    ],
    recommendedAction: "DO_NOT_INVOKE",
  };
}

function invalidDiagnosisEnvelope(
  fit: CapabilityFitResult,
  issues: readonly {
    readonly path?: string;
    readonly code: string;
    readonly message: string;
  }[],
): ComponentResultEnvelope {
  return {
    componentId: chemistryCalculationTrainerManifest.componentId,
    componentVersion: chemistryCalculationTrainerManifest.componentVersion,
    coverage: fit.coverage,
    status: "INVALID_INPUT",
    preflight: fit,
    limitations: fit.limitations,
    issues,
  };
}

function diagnosisEnvelope(
  fit: CapabilityFitResult,
  diagnosis: DiagnosisEngineResult,
): ComponentResultEnvelope {
  if (!diagnosis.ok) {
    return invalidDiagnosisEnvelope(
      fit,
      diagnosis.issues.map(({ path, code, message }) => ({ path, code, message })),
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
    preflight: fit,
    result: diagnosis.trace,
    limitations: fit.limitations,
  };
}

export function invokeChemistryCalculationTrainer(
  invocation: unknown,
): ComponentResultEnvelope {
  if (!isRecord(invocation)) {
    return invalidDiagnosisEnvelope(invalidInvocationFit(), [
      {
        path: "$",
        code: "INVALID_INVOCATION",
        message: "Component invocation must be an object.",
      },
    ]);
  }
  if (!isRecord(invocation.request)) {
    return invalidDiagnosisEnvelope(invalidInvocationFit(), [
      {
        path: "$.request",
        code: "INVALID_REQUEST",
        message: "Learning request descriptor must be an object.",
      },
    ]);
  }
  const requestRecord = invocation.request;
  const requestIssues: ComponentIssue[] = [];
  if (typeof requestRecord.task !== "string" || requestRecord.task.trim() === "") {
    requestIssues.push({
      path: "$.request.task",
      code: "INVALID_TASK",
      message: "Task must be a non-empty string.",
    });
  }
  if (
    requestRecord.problemDefinition !== null &&
    typeof requestRecord.problemDefinition !== "string"
  ) {
    requestIssues.push({
      path: "$.request.problemDefinition",
      code: "INVALID_PROBLEM_DEFINITION",
      message: "Problem definition must be a string or null.",
    });
  }
  if (typeof requestRecord.inputKind !== "string" || requestRecord.inputKind.trim() === "") {
    requestIssues.push({
      path: "$.request.inputKind",
      code: "INVALID_INPUT_KIND",
      message: "Input kind must be a non-empty string.",
    });
  }
  if (requestIssues.length > 0) {
    return invalidDiagnosisEnvelope(invalidInvocationFit(), requestIssues);
  }
  const request = requestRecord as unknown as LearningRequestDescriptor;
  const fit = preflightChemistryCalculationTrainer(request);
  const invocationIssues: ComponentIssue[] = [];
  const input = invocation.input;
  if (!isRecord(input)) {
    invocationIssues.push({
      path: "$.input",
      code: "INVALID_INPUT_ENVELOPE",
      message: "Invocation input must be a tagged object.",
    });
  } else if (typeof input.kind !== "string") {
    invocationIssues.push({
      path: "$.input.kind",
      code: "INVALID_INPUT_KIND",
      message: "Invocation input requires a string kind discriminant.",
    });
  } else if (input.kind !== request.inputKind) {
    invocationIssues.push({
      path: "$.input.kind",
      code: "INVOCATION_INPUT_MISMATCH",
      message: "Invocation input kind must match the preflight request descriptor.",
    });
  }
  const contextIssues: ComponentIssue[] = [];
  const context = validateContext(invocation.context, contextIssues);
  invocationIssues.push(...contextIssues);
  if (isRecord(input) && request.inputKind === "normalized-attempt" && !("attempt" in input)) {
    invocationIssues.push({
      path: "$.input.attempt",
      code: "MISSING_NORMALIZED_ATTEMPT",
      message: "Normalized invocation requires an attempt value.",
    });
  }
  if (isRecord(input) && request.inputKind === "legacy-seven-step-structured-input") {
    const submission = input.submission;
    if (
      !isRecord(submission) ||
      typeof submission.attemptId !== "string" ||
      !isIsoUtcTimestamp(submission.submittedAt) ||
      !isRecord(submission.steps)
    ) {
      invocationIssues.push({
        path: "$.input.submission",
        code: "INVALID_LEGACY_SUBMISSION",
        message: "Legacy input requires attemptId, ISO submittedAt, and structured steps.",
      });
    }
  }
  if (invocationIssues.length > 0 || !isRecord(input) || !context) {
    return invalidDiagnosisEnvelope(fit, invocationIssues);
  }
  if (fit.coverage !== "EXACT_MATCH") {
    return {
      componentId: chemistryCalculationTrainerManifest.componentId,
      componentVersion: chemistryCalculationTrainerManifest.componentVersion,
      coverage: fit.coverage,
      status:
        fit.coverage === "PARTIAL_MATCH"
          ? "REQUIRES_INTERPRETER"
          : "NOT_INVOKED_UNSUPPORTED",
      preflight: fit,
      limitations: fit.limitations,
      issues: fit.missingCapabilities.map((capability) => ({
        code: "MISSING_CAPABILITY",
        message: capability,
      })),
    };
  }
  if (input.kind === "legacy-seven-step-structured-input") {
    const submission = input.submission as CalculationPathSubmission;
    const adapted = adaptV1SubmissionToV2(
      kpFromEquilibriumMoles,
      submission,
    );
    if (!adapted.ok) {
      return invalidDiagnosisEnvelope(fit, [
        { code: adapted.code, message: adapted.message },
      ]);
    }
    return diagnosisEnvelope(
      fit,
      diagnoseNormalizedAttempt(kpGoldProblemV2, adapted.attempt, {
        ...context,
        submittedAt: submission.submittedAt,
        interpreter: {
          kind: "STRUCTURED_ADAPTER",
          adapterVersion: "v1-structured-v1",
        },
      }),
    );
  }
  const diagnosis = diagnoseNormalizedAttempt(
    kpGoldProblemV2,
    input.attempt,
    context,
  );
  return diagnosisEnvelope(fit, diagnosis);
}

/**
 * Developer-only authored fixture runner. It is not an operational learner input
 * and is intentionally absent from capability preflight and LearningComponent.invoke.
 */
export function invokeChemistryCalculationTrainerDeveloperScenario(
  invocation: TrainerDeveloperScenarioInvocation,
): ComponentResultEnvelope {
  const fit = preflightChemistryCalculationTrainer({
    task: DIAGNOSIS_TASK,
    problemDefinition: SUPPORTED_PROBLEM_DEFINITION,
    inputKind: "normalized-attempt",
  });
  const attempt = createTypedWorkingMockAttempt(
    invocation.input.scenario,
    invocation.input.attemptId,
    invocation.input.submittedAt,
  );
  return diagnosisEnvelope(
    fit,
    diagnoseNormalizedAttempt(kpGoldProblemV2, attempt, {
      ...invocation.context,
      submittedAt: invocation.input.submittedAt,
      interpreter: {
        kind: "TYPED_WORKING_MOCK",
        adapterVersion: "typed-working-mock-v1",
      },
    }),
  );
}

export const chemistryCalculationTrainer = Object.freeze({
  manifest: chemistryCalculationTrainerManifest,
  preflight: preflightChemistryCalculationTrainer,
  invoke: invokeChemistryCalculationTrainer,
}) satisfies LearningComponent;

export type {
  CapabilityFitResult,
  ComponentIssue,
  ComponentManifest,
  ComponentResultEnvelope,
  LearningRequestDescriptor,
  TrainerDeveloperScenarioInvocation,
} from "./types";
