import type { DiagnosticEvidenceTraceV2 } from "../domain/v2/types";
import type { DiagnosisContext } from "../domain/v2/diagnosisEngine";
import type { CalculationPathSubmission } from "../domain/types";
import type { TypedWorkingMockScenario } from "../mocks/v2/typedWorkingScenarios";

export type CapabilityCoverage = "EXACT_MATCH" | "PARTIAL_MATCH" | "UNSUPPORTED";

export type ComponentRecommendedAction =
  | "INVOKE_COMPONENT"
  | "REQUIRE_INTERPRETER"
  | "DO_NOT_INVOKE";

export type InterpreterRequiredInputKind =
  | "natural-language-working"
  | "handwriting-image"
  | "digital-ink"
  | "scanned-document"
  | "mixed-working";

export interface ComponentManifest {
  readonly manifestSchemaVersion: "1.0.0";
  readonly componentId: string;
  readonly componentVersion: string;
  readonly componentType: "trainer";
  readonly domain: {
    readonly curriculum: string;
    readonly topic: string;
    readonly supportedProblemDefinitions: readonly string[];
  };
  readonly supportedTasks: readonly string[];
  readonly operationalInputs: readonly string[];
  readonly executionRequirements: readonly string[];
  readonly developerFixtures: readonly TypedWorkingMockScenario[];
  readonly contractDependencies: {
    readonly measurementContract: string;
    readonly problemDefinition: string;
  };
  readonly outputs: readonly string[];
  readonly guarantees: {
    readonly diagnosis: string;
    readonly arithmetic: string;
    readonly problemCoverage: string;
  };
  readonly unsupported: readonly string[];
}

export interface LearningRequestDescriptor {
  readonly task: string;
  readonly problemDefinition: string | null;
  readonly inputKind: string;
}

export interface CapabilityMatchDimensions {
  readonly task: boolean;
  readonly problemDefinition: boolean;
  readonly inputReady: boolean;
}

export interface CapabilityFitResult {
  readonly coverage: CapabilityCoverage;
  readonly componentId: string;
  readonly matchDimensions: CapabilityMatchDimensions;
  readonly matchedCapabilities: readonly string[];
  readonly missingCapabilities: readonly string[];
  readonly limitations: readonly string[];
  readonly recommendedAction: ComponentRecommendedAction;
}

export type ComponentInvocationStatus =
  | "COMPLETED"
  | "RECOGNITION_UNCERTAIN"
  | "INVALID_INPUT"
  | "REQUIRES_INTERPRETER"
  | "NOT_INVOKED_UNSUPPORTED";

export interface ComponentIssue {
  readonly path?: string;
  readonly code: string;
  readonly message: string;
}

export interface ComponentResultEnvelope {
  readonly componentId: string;
  readonly componentVersion: string;
  readonly coverage: CapabilityCoverage;
  readonly status: ComponentInvocationStatus;
  readonly preflight: CapabilityFitResult;
  readonly result?: DiagnosticEvidenceTraceV2;
  readonly limitations: readonly string[];
  readonly issues?: readonly ComponentIssue[];
}

export type ComponentInvocationInput =
  | {
      readonly kind: "normalized-attempt";
      readonly attempt: unknown;
    }
  | {
      readonly kind: "legacy-seven-step-structured-input";
      readonly submission: CalculationPathSubmission;
    }
  | {
      readonly kind: InterpreterRequiredInputKind;
    };

export interface ComponentInvocation {
  readonly request: LearningRequestDescriptor;
  readonly input: ComponentInvocationInput;
  readonly context: DiagnosisContext;
}

export interface TrainerDeveloperScenarioInvocation {
  readonly input: {
    readonly scenario: TypedWorkingMockScenario;
    readonly attemptId: string;
    readonly submittedAt: string;
  };
  readonly context: DiagnosisContext;
}

export interface LearningComponent {
  readonly manifest: ComponentManifest;
  preflight(request: LearningRequestDescriptor): CapabilityFitResult;
  invoke(invocation: unknown): ComponentResultEnvelope;
}
