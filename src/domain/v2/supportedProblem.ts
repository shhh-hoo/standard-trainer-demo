import { kpGoldProblemV2 } from "../../fixtures/v2/kpGoldProblem";
import type { ValidationResult } from "./runtimeValidation";
import type { DiagnosticProblemDefinitionV2 } from "./types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}

export function canonicalizeDiagnosticProblem(
  problem: DiagnosticProblemDefinitionV2,
): string {
  return JSON.stringify(canonicalize(problem));
}

const canonicalSupportedProblem = canonicalizeDiagnosticProblem(kpGoldProblemV2);

export function validateSupportedDiagnosticProblem(
  problem: DiagnosticProblemDefinitionV2,
): ValidationResult<DiagnosticProblemDefinitionV2> {
  return canonicalizeDiagnosticProblem(problem) === canonicalSupportedProblem
    ? { ok: true, value: problem }
    : {
        ok: false,
        issues: [
          {
            path: "$problem",
            code: "UNSUPPORTED_PROBLEM_DEFINITION",
            message:
              "This engine only supports the exact canonical KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD@2.0.0-gold.2 definition.",
          },
        ],
      };
}
