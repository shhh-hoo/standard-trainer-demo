import { V2_CONTRACT_VERSION, type ExpressionAst, type NormalizedAttempt, type QuantityValue, type VariableReference } from "../../domain/v2/types";
import { kpFormulaAst, kpGoldProblemV2 } from "../../fixtures/v2/kpGoldProblem";
import { typedWorkingScenarioDisplay, type TypedWorkingMockScenario } from "../../mocks/v2/typedWorkingScenarios";

function variable(reference: VariableReference): ExpressionAst {
  return { kind: "VARIABLE", reference };
}

function fact(symbol: string, factId: string): VariableReference {
  return { source: "AUTHORED_FACT", symbol, factId };
}

function quantity(symbol: string, reasoningNodeId: string): VariableReference {
  return { source: "REASONING_QUANTITY", symbol, reasoningNodeId };
}

function binary(
  operator: "ADD" | "DIVIDE" | "MULTIPLY" | "POWER",
  left: ExpressionAst,
  right: ExpressionAst,
): ExpressionAst {
  return { kind: "BINARY", operator, left, right };
}

function compressedExpression(): ExpressionAst {
  const nN2O4 = variable(fact("n_N2O4", "equilibrium-moles-n2o4"));
  const nNO2 = variable(fact("n_NO2", "equilibrium-moles-no2"));
  const pressure = variable(fact("P_total", "total-pressure"));
  const total = () => binary("ADD", nN2O4, nNO2);
  const pNO2 = binary("MULTIPLY", binary("DIVIDE", nNO2, total()), pressure);
  const pN2O4 = binary("MULTIPLY", binary("DIVIDE", nN2O4, total()), pressure);
  return binary(
    "DIVIDE",
    binary("POWER", pNO2, { kind: "NUMBER", value: 2, raw: "2" }),
    pN2O4,
  );
}

function invertedFormula(): ExpressionAst {
  return binary(
    "DIVIDE",
    variable(quantity("p_N2O4", "partial-pressure-n2o4")),
    binary(
      "POWER",
      variable(quantity("p_NO2", "partial-pressure-no2")),
      { kind: "NUMBER", value: 2, raw: "2" },
    ),
  );
}

export function createTypedWorkingMockAttempt(
  scenario: TypedWorkingMockScenario,
  attemptId: string,
  submittedAt: string,
): NormalizedAttempt {
  const stepId = "typed-working-mock-step";
  const isExplanation = scenario === "EXPLANATION_ONLY";
  const isCorrect = scenario === "COMPRESSED_CORRECT";
  const isInverted = scenario === "INVERTED_FORMULA";
  const formulaAst = isInverted ? invertedFormula() : kpFormulaAst;
  const declaredResult: QuantityValue | undefined = isCorrect
    ? { value: 450, unit: "kPa", significantFigures: 3, raw: "4.50 × 10² kPa" }
    : isInverted
      ? { value: 0.00222, unit: "kPa⁻¹", significantFigures: 3, raw: "0.00222 kPa⁻¹" }
      : scenario === "WRONG_DEPENDENCY"
        ? { value: 0.9, significantFigures: 3, raw: "0.900" }
        : undefined;
  const calculationExpression = isCorrect
    ? compressedExpression()
    : isInverted
      ? binary(
          "DIVIDE",
          { kind: "NUMBER", value: 200, raw: "200" },
          binary(
            "POWER",
            { kind: "NUMBER", value: 300, raw: "300" },
            { kind: "NUMBER", value: 2, raw: "2" },
          ),
        )
      : binary(
          "DIVIDE",
          binary(
            "POWER",
            variable(fact("n_NO2", "equilibrium-moles-no2")),
            { kind: "NUMBER", value: 2, raw: "2" },
          ),
          variable(fact("n_N2O4", "equilibrium-moles-n2o4")),
        );
  const step = {
    id: stepId,
    revisionId: "typed-working-mock-revision",
    source: {
      artifactId: "typed-working-mock-artifact",
      modality: isExplanation ? ("EXPLANATION" as const) : ("TYPED_WORKING" as const),
      textSpan: `scenario:${scenario}`,
    },
    rawTranscription: typedWorkingScenarioDisplay[scenario],
    semanticType: isExplanation ? ("STRATEGY" as const) : ("FINAL_ANSWER" as const),
    concept: isExplanation ? ("KP_EXPRESSION" as const) : ("KP_RESULT" as const),
    formulaAst,
    ...(declaredResult
      ? {
          calculation: {
            target: quantity("Kp", "calculate-result"),
            expression: calculationExpression,
            declaredResult,
          },
        }
      : {}),
    recognition: { status: "AUTO_ACCEPTED" as const, confidence: 1 },
  };
  return {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId,
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: isExplanation ? "EXPLANATION" : "TYPED_WORKING",
    artifacts: [
      {
        id: "typed-working-mock-artifact",
        modality: isExplanation ? "EXPLANATION" : "TYPED_WORKING",
        mediaType: "text/plain",
        contentRef: `mock-scenario://${scenario}`,
      },
    ],
    factsUsed: isExplanation
      ? []
      : [
          { factId: "equilibrium-moles-n2o4", observedValue: 0.4, unit: "mol", evidenceStepIds: [stepId] },
          { factId: "equilibrium-moles-no2", observedValue: 0.6, unit: "mol", evidenceStepIds: [stepId] },
          ...(isCorrect
            ? [
                { factId: "total-pressure", observedValue: 500, unit: "kPa", evidenceStepIds: [stepId] },
                { factId: "required-precision", observedValue: 3, unit: "significant figures", evidenceStepIds: [stepId] },
              ]
            : []),
        ],
    target: { quantity: "KP", evidenceStepIds: [stepId], explicit: isExplanation || !isCorrect },
    steps: [step],
    revisions: [
      {
        id: "typed-working-mock-revision",
        sequence: 1,
        submittedAt,
        stepIds: [stepId],
        precededByAssistanceEventIds: [],
      },
    ],
    finalAnswer: declaredResult ?? null,
    recognitionIssues: [],
    assistanceEvents: [],
  };
}

export type { TypedWorkingMockScenario } from "../../mocks/v2/typedWorkingScenarios";
