import type { DiagnosticProblemDefinitionV2 } from "./types";
import type { ValidationResult } from "./runtimeValidation";

const supportedNodeIds = [
  "select-relevant-data",
  "identify-kp-target",
  "choose-partial-pressure-strategy",
  "total-moles",
  "mole-fraction-n2o4",
  "mole-fraction-no2",
  "partial-pressure-n2o4",
  "partial-pressure-no2",
  "construct-kp-expression",
  "substitute-values",
  "calculate-result",
  "report-unit",
  "report-precision",
] as const;

export function validateSupportedDiagnosticProblem(
  problem: DiagnosticProblemDefinitionV2,
): ValidationResult<DiagnosticProblemDefinitionV2> {
  const supported =
    problem.id === "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD" &&
    problem.version === "2.0.0-gold.2" &&
    problem.reasoningGraph.version === "kp-reasoning-graph-v2.0.0-gold.2" &&
    problem.diagnosisPolicyVersion === "diagnosis-policy-v2.0.0-gold.2" &&
    problem.recognitionPolicy.version === "recognition-policy-v2.0.0-gold.2" &&
    problem.hintPolicy.version === "hint-policy-v2.0.0-gold.2" &&
    JSON.stringify(problem.reasoningGraph.pedagogicalOrder) ===
      JSON.stringify(supportedNodeIds) &&
    JSON.stringify(problem.reasoningGraph.acceptedStrategies.map(({ id }) => id)) ===
      JSON.stringify(["EXPLICIT_PARTIAL_PRESSURES", "COMPRESSED_DIRECT_SUBSTITUTION"]) &&
    JSON.stringify(problem.formulaDefinitions.map(({ id }) => id)) ===
      JSON.stringify(["formula-kp-no2-n2o4"]);
  return supported
    ? { ok: true, value: problem }
    : {
        ok: false,
        issues: [
          {
            path: "$problem",
            code: "UNSUPPORTED_PROBLEM_DEFINITION",
            message:
              "This engine only supports KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2.",
          },
        ],
      };
}
