import type { DiagnosticEvidenceTraceV2 } from "../domain/v2/types";
import type { DiagnosisContext } from "../domain/v2/diagnosisEngine";
import type { CalculationPathSubmission } from "../domain/types";
import type { TypedWorkingMockScenario } from "../mocks/v2/typedWorkingScenarios";

export type CapabilityCoverage = "EXACT_MATCH" | "PARTIAL_MATCH" | "UNSUPPORTED";

export type ComponentRecommendedAction =
  | "INVOKE_COMPONENT"
  | "REQUIRE_INTERPRETER"
  | "USE_TEMPORARY_SUPPORT"
  | "RECORD_CAPABILITY_GAP";

export interface ComponentManifest {
  readonly componentId: string;
  readonly componentVersion: string;
  readonly componentType: "trainer";
  readonly domain: {
    readonly curriculum: string;
    readonly topic: string;
    readonly supportedProblemDefinitions: readonly string[];
  };
  readonly supportedTasks: readonly string[];
  readonly supportedInputs: readonly string[];
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
  readonly demandSignal?: "LOW_RISK_ONE_OFF" | "REPEATED_HIGH_VALUE";
}

export interface CapabilityFitResult {
  readonly coverage: CapabilityCoverage;
  readonly componentId: string;
  readonly fitScore: number;
  readonly matchedCapabilities: readonly string[];
  readonly missingCapabilities: readonly string[];
  readonly limitations: readonly string[];
  readonly recommendedAction: ComponentRecommendedAction;
}

export interface ComponentResultEnvelope {
  readonly componentId: string;
  readonly componentVersion: string;
  readonly coverage: CapabilityCoverage;
  readonly status:
    | "COMPLETED"
    | "RECOGNITION_UNCERTAIN"
    | "INVALID_INPUT"
    | "UNSUPPORTED";
  readonly result?: DiagnosticEvidenceTraceV2;
  readonly limitations: readonly string[];
  readonly issues?: readonly {
    readonly code: string;
    readonly message: string;
  }[];
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
      readonly kind: "explicit-mock-scenario";
      readonly scenario: TypedWorkingMockScenario;
      readonly attemptId: string;
      readonly submittedAt: string;
    };

export interface ComponentInvocation {
  readonly request: LearningRequestDescriptor;
  readonly input: ComponentInvocationInput;
  readonly context: DiagnosisContext;
}

export interface LearningComponent {
  readonly manifest: ComponentManifest;
  preflight(request: LearningRequestDescriptor): CapabilityFitResult;
  invoke(invocation: ComponentInvocation): ComponentResultEnvelope;
}
