import type { RuntimeCapabilityProfile } from "./types";

export const STANDARD_TRAINER_CAPABILITY: RuntimeCapabilityProfile = {
  runtimeId: "standard-trainer-demo",
  runtimeVersion: "0.3.0",
  supportedSchemaVersions: ["1.0.0"],
  supportedTargetKinds: ["KP", "MASS"],
  supportedExpressionNodes: ["NUMBER", "VARIABLE", "BINARY", "FUNCTION:SUM"],
  supportedDiagnosisCategories: ["DATA_EXTRACTION", "TARGET_IDENTIFICATION", "STRATEGY", "FORMULA", "SUBSTITUTION", "ARITHMETIC", "UNIT", "PRECISION"],
  supportedFailureCodes: ["RELEVANT_DATA_OMITTED", "IRRELEVANT_DATA_USED", "TARGET_MISIDENTIFIED", "WRONG_METHOD", "MISSING_REASONING_LINK", "WRONG_FORMULA", "WRONG_STOICHIOMETRIC_RATIO", "WRONG_VALUE_SUBSTITUTED", "ARITHMETIC_ERROR", "UNIT_ERROR", "SIGNIFICANT_FIGURES_ERROR"],
  limitations: ["Only KP and MASS published components are executable.", "Only structured learner evidence is accepted.", "The runtime does not evaluate arbitrary chemistry questions or arbitrary generated content."],
};
