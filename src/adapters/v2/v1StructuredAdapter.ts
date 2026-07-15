import type { CalculationPathSubmission, ProblemDefinition, StudentStepInput } from "../../domain/types";
import { V2_CONTRACT_VERSION, type ExpressionAst, type NormalizedAttempt, type NormalizedStep, type QuantityValue, type VariableReference } from "../../domain/v2/types";
import { kpFormulaAst, kpGoldProblemV2 } from "../../fixtures/v2/kpGoldProblem";

export type V1StructuredAdapterResult =
  | { readonly ok: true; readonly attempt: NormalizedAttempt }
  | {
      readonly ok: false;
      readonly code: "UNSUPPORTED_PROBLEM" | "UNSUPPORTED_EXPRESSION";
      readonly message: string;
    };

function variable(reference: VariableReference): ExpressionAst {
  return { kind: "VARIABLE", reference };
}

function binary(
  operator: "ADD" | "DIVIDE" | "MULTIPLY" | "POWER",
  left: ExpressionAst,
  right: ExpressionAst,
): ExpressionAst {
  return { kind: "BINARY", operator, left, right };
}

function fact(symbol: string, factId: string): VariableReference {
  return { source: "AUTHORED_FACT", symbol, factId };
}

function stepResult(symbol: string, stepId: string): VariableReference {
  return { source: "NORMALIZED_STEP_RESULT", symbol, stepId };
}

function quantity(symbol: string, reasoningNodeId: string): VariableReference {
  return { source: "REASONING_QUANTITY", symbol, reasoningNodeId };
}

function declared(input: StudentStepInput): QuantityValue | undefined {
  if (input.numericValue === undefined) return undefined;
  const raw = `${input.numericValue}${input.unit ? ` ${input.unit}` : ""}`;
  return {
    value: input.numericValue,
    ...(input.unit ? { unit: input.unit } : {}),
    ...(input.significantFigures === undefined
      ? {}
      : { significantFigures: input.significantFigures }),
    raw,
  };
}

function normalizedExpression(expression: string): string {
  return expression
    .normalize("NFKC")
    .replaceAll("₂", "2")
    .replaceAll("₄", "4")
    .replace(/[\s_()]/g, "")
    .toLowerCase();
}

function mapCuratedFormula(expression: string): ExpressionAst | null {
  const normalized = normalizedExpression(expression);
  if (normalized === "pno2^2/pn2o4") return kpFormulaAst;
  if (normalized === "pn2o4/pno2^2") {
    return {
      kind: "BINARY",
      operator: "DIVIDE",
      left: {
        kind: "VARIABLE",
        reference: {
          source: "REASONING_QUANTITY",
          symbol: "p_N2O4",
          reasoningNodeId: "partial-pressure-n2o4",
        },
      },
      right: {
        kind: "BINARY",
        operator: "POWER",
        left: {
          kind: "VARIABLE",
          reference: {
            source: "REASONING_QUANTITY",
            symbol: "p_NO2",
            reasoningNodeId: "partial-pressure-no2",
          },
        },
        right: { kind: "NUMBER", value: 2, raw: "2" },
      },
    };
  }
  return null;
}

function makeStep(
  id: string,
  input: StudentStepInput,
  semanticType: NormalizedStep["semanticType"],
  concept: NormalizedStep["concept"],
  calculation?: NormalizedStep["calculation"],
  formulaAst?: ExpressionAst,
): NormalizedStep {
  const display =
    input.expression ??
    `${input.numericValue ?? ""}${input.unit ? ` ${input.unit}` : ""}`.trim();
  return {
    id,
    revisionId: "v1-structured-revision",
    source: {
      artifactId: "v1-structured-artifact",
      modality: "STRUCTURED",
      textSpan: `field:${id}`,
    },
    rawTranscription: display,
    semanticType,
    concept,
    ...(formulaAst ? { formulaAst } : {}),
    ...(calculation ? { calculation } : {}),
    recognition: { status: "AUTO_ACCEPTED", confidence: 1 },
  };
}

export function adaptV1SubmissionToV2(
  problem: ProblemDefinition,
  submission: CalculationPathSubmission,
): V1StructuredAdapterResult {
  if (problem.id !== "KP_FROM_EQUILIBRIUM_MOLES") {
    return {
      ok: false,
      code: "UNSUPPORTED_PROBLEM",
      message: "The V1 adapter only supports KP_FROM_EQUILIBRIUM_MOLES.",
    };
  }
  const expressionInput = submission.steps.kpExpression?.expression;
  const mappedFormula = expressionInput ? mapCuratedFormula(expressionInput) : undefined;
  if (expressionInput && !mappedFormula) {
    return {
      ok: false,
      code: "UNSUPPORTED_EXPRESSION",
      message: "The V1 adapter only maps the curated Kp relation and its inverted error form.",
    };
  }
  const curatedFormula = mappedFormula ?? undefined;

  const nN2O4 = fact("n_N2O4", "equilibrium-moles-n2o4");
  const nNO2 = fact("n_NO2", "equilibrium-moles-no2");
  const pressure = fact("P_total", "total-pressure");
  const definitions: readonly {
    readonly key: string;
    readonly semanticType: NormalizedStep["semanticType"];
    readonly concept: NormalizedStep["concept"];
    readonly target?: VariableReference;
    readonly expression?: ExpressionAst;
  }[] = [
    {
      key: "totalMoles",
      semanticType: "ARITHMETIC",
      concept: "TOTAL_MOLES",
      target: quantity("n_total", "total-moles"),
      expression: binary("ADD", variable(nN2O4), variable(nNO2)),
    },
    {
      key: "moleFractionN2O4",
      semanticType: "SUBSTITUTION",
      concept: "MOLE_FRACTION",
      target: quantity("x_N2O4", "mole-fraction-n2o4"),
      expression: binary(
        "DIVIDE",
        variable(nN2O4),
        variable(stepResult("n_total", "totalMoles")),
      ),
    },
    {
      key: "moleFractionNO2",
      semanticType: "SUBSTITUTION",
      concept: "MOLE_FRACTION",
      target: quantity("x_NO2", "mole-fraction-no2"),
      expression: binary(
        "DIVIDE",
        variable(nNO2),
        variable(stepResult("n_total", "totalMoles")),
      ),
    },
    {
      key: "partialPressureN2O4",
      semanticType: "SUBSTITUTION",
      concept: "PARTIAL_PRESSURE",
      target: quantity("p_N2O4", "partial-pressure-n2o4"),
      expression: binary(
        "MULTIPLY",
        variable(stepResult("x_N2O4", "moleFractionN2O4")),
        variable(pressure),
      ),
    },
    {
      key: "partialPressureNO2",
      semanticType: "SUBSTITUTION",
      concept: "PARTIAL_PRESSURE",
      target: quantity("p_NO2", "partial-pressure-no2"),
      expression: binary(
        "MULTIPLY",
        variable(stepResult("x_NO2", "moleFractionNO2")),
        variable(pressure),
      ),
    },
  ];
  const present = new Set(Object.keys(submission.steps));
  const steps: NormalizedStep[] = [];
  for (const definition of definitions) {
    const input = submission.steps[definition.key];
    if (!input) continue;
    const dependencies = Array.from(
      (function collect(expression: ExpressionAst): Set<string> {
        if (expression.kind === "VARIABLE") {
          return new Set(
            expression.reference.source === "NORMALIZED_STEP_RESULT"
              ? [expression.reference.stepId]
              : [],
          );
        }
        if (expression.kind === "NUMBER") return new Set();
        if (expression.kind === "FUNCTION") {
          return new Set(expression.arguments.flatMap((item) => [...collect(item)]));
        }
        return new Set([...collect(expression.left), ...collect(expression.right)]);
      })(definition.expression!),
    );
    const calculation =
      dependencies.every((dependency) => present.has(dependency)) && declared(input)
        ? {
            target: definition.target!,
            expression: definition.expression!,
            declaredResult: declared(input),
          }
        : undefined;
    steps.push(
      makeStep(
        definition.key,
        input,
        definition.semanticType,
        definition.concept,
        calculation,
      ),
    );
  }
  if (submission.steps.kpExpression) {
    steps.push(
      makeStep(
        "kpExpression",
        submission.steps.kpExpression,
        "FORMULA",
        "KP_EXPRESSION",
        undefined,
        curatedFormula,
      ),
    );
  }
  const finalInput = submission.steps.kpResult;
  const finalDeclared = finalInput ? declared(finalInput) : undefined;
  const finalDependenciesPresent = [
    "partialPressureN2O4",
    "partialPressureNO2",
    "kpExpression",
  ].every((key) => present.has(key));
  if (finalInput) {
    steps.push(
      makeStep(
        "kpResult",
        finalInput,
        "FINAL_ANSWER",
        "KP_RESULT",
        finalDeclared && finalDependenciesPresent
          ? {
              target: quantity("Kp", "calculate-result"),
              expression: binary(
                "DIVIDE",
                binary(
                  "POWER",
                  variable(stepResult("p_NO2", "partialPressureNO2")),
                  { kind: "NUMBER", value: 2, raw: "2" },
                ),
                variable(stepResult("p_N2O4", "partialPressureN2O4")),
              ),
              declaredResult: finalDeclared,
            }
          : undefined,
        curatedFormula,
      ),
    );
  }

  const firstEvidenceStepId = steps[0]?.id;
  const targetEvidenceStepId = steps.find(({ id }) => id === "kpExpression")?.id ??
    steps.find(({ id }) => id === "kpResult")?.id;
  const eventTimestamp = new Date(Date.parse(submission.submittedAt) - 1_000).toISOString();
  const attempt: NormalizedAttempt = {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: submission.attemptId,
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "GUIDE_ME",
    modality: "STRUCTURED",
    artifacts: [
      {
        id: "v1-structured-artifact",
        modality: "STRUCTURED",
        mediaType: "application/vnd.standard-trainer.v1-structured+json",
        contentRef: `v1-structured://${submission.attemptId}`,
      },
    ],
    factsUsed: firstEvidenceStepId
      ? [
          { factId: "equilibrium-moles-n2o4", observedValue: 0.4, unit: "mol", evidenceStepIds: [firstEvidenceStepId] },
          { factId: "equilibrium-moles-no2", observedValue: 0.6, unit: "mol", evidenceStepIds: [firstEvidenceStepId] },
          { factId: "total-pressure", observedValue: 500, unit: "kPa", evidenceStepIds: [firstEvidenceStepId] },
          { factId: "required-precision", observedValue: 3, unit: "significant figures", evidenceStepIds: [firstEvidenceStepId] },
        ]
      : [],
    target: targetEvidenceStepId
      ? { quantity: "KP", evidenceStepIds: [targetEvidenceStepId], explicit: true }
      : null,
    steps,
    revisions: [
      {
        id: "v1-structured-revision",
        sequence: 2,
        submittedAt: submission.submittedAt,
        stepIds: steps.map(({ id }) => id),
        precededByAssistanceEventIds: ["v1-full-scaffold"],
      },
    ],
    finalAnswer: finalDeclared && finalDependenciesPresent ? finalDeclared : null,
    recognitionIssues: [],
    assistanceEvents: [
      {
        id: "v1-full-scaffold",
        sequence: 1,
        stage: "SUBSTITUTION",
        level: 4,
        hintId: "FULL-SCAFFOLD-KP-01",
        trigger: "LEARNER_REQUEST",
        revealedReasoningNodeIds: [
          "total-moles",
          "mole-fraction-n2o4",
          "mole-fraction-no2",
          "partial-pressure-n2o4",
          "partial-pressure-no2",
          "construct-kp-expression",
          "substitute-values",
        ],
        revealedContentIds: ["scaffold-v0.1-seven-step-kp"],
        timestamp: eventTimestamp,
      },
    ],
  };
  return { ok: true, attempt };
}
