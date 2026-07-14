import {
  V2_CONTRACT_VERSION,
  type AttemptArtifact,
  type AttemptRevision,
  type DiagnosisCategory,
  type DiagnosisFailureCode,
  type EquationEvidence,
  type EvaluationStatus,
  type ExpectedStageEvaluation,
  type ExpressionAst,
  type FactUse,
  type NormalizedAttemptFixture,
  type NormalizedStep,
  type QuantityValue,
  type RecognitionEvidence,
  type StepSource,
  type VariableReference,
} from "../../domain/v2/types";
import { kpFormulaAst, kpGoldProblemV2 } from "./kpGoldProblem";

const submittedAt = "2026-07-14T08:00:00.000Z";
const diagnosisOrder: readonly DiagnosisCategory[] = [
  "DATA_EXTRACTION",
  "TARGET_IDENTIFICATION",
  "STRATEGY",
  "FORMULA",
  "SUBSTITUTION",
  "ARITHMETIC",
  "UNIT",
  "PRECISION",
];

interface StageOverride {
  readonly status: EvaluationStatus;
  readonly failureCode?: DiagnosisFailureCode | null;
  readonly evidenceStepIds?: readonly string[];
}

function stages(
  overrides: Partial<Record<DiagnosisCategory, StageOverride>>,
): readonly ExpectedStageEvaluation[] {
  return diagnosisOrder.map((category) => {
    const override = overrides[category];
    return {
      category,
      status: override?.status ?? "NOT_OBSERVED",
      failureCode: override?.failureCode ?? null,
      evidenceStepIds: override?.evidenceStepIds ?? [],
    };
  });
}

function solvedStages(stepIds: readonly string[], dataStatus: EvaluationStatus = "CORRECT") {
  return stages({
    DATA_EXTRACTION: { status: dataStatus, evidenceStepIds: stepIds },
    TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: stepIds },
    STRATEGY: { status: "CORRECT", evidenceStepIds: stepIds },
    FORMULA: { status: "CORRECT", evidenceStepIds: stepIds },
    SUBSTITUTION: { status: "CORRECT", evidenceStepIds: stepIds },
    ARITHMETIC: { status: "CORRECT", evidenceStepIds: stepIds },
    UNIT: { status: "CORRECT", evidenceStepIds: stepIds },
    PRECISION: { status: "CORRECT", evidenceStepIds: stepIds },
  });
}

function textSource(
  artifactId: string,
  modality: "TYPED_WORKING" | "EXPLANATION" | "STRUCTURED",
  textSpan: string,
): StepSource {
  return { artifactId, modality, textSpan };
}

function visualSource(
  artifactId: string,
  modality: "HANDWRITING_IMAGE" | "DIGITAL_INK",
  y: number,
): StepSource {
  return {
    artifactId,
    modality,
    page: 1,
    boundingBox: {
      x: 0.08,
      y,
      width: 0.84,
      height: 0.07,
      coordinateSpace: "NORMALIZED_0_TO_1",
    },
  };
}

function autoAccepted(confidence = 1): RecognitionEvidence {
  return { status: "AUTO_ACCEPTED", confidence };
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

function variable(reference: VariableReference): ExpressionAst {
  return { kind: "VARIABLE", reference };
}

function number(value: number, raw = String(value)): ExpressionAst {
  return { kind: "NUMBER", value, raw };
}

function binary(
  operator: "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE" | "POWER",
  left: ExpressionAst,
  right: ExpressionAst,
): ExpressionAst {
  return { kind: "BINARY", operator, left, right };
}

function result(
  value: number,
  unit?: string,
  significantFigures?: number,
  raw?: string,
): QuantityValue {
  return {
    value,
    ...(unit === undefined ? {} : { unit }),
    ...(significantFigures === undefined ? {} : { significantFigures }),
    ...(raw === undefined ? {} : { raw }),
  };
}

const nN2O4 = fact("n_N2O4", "equilibrium-moles-n2o4");
const nNO2 = fact("n_NO2", "equilibrium-moles-no2");
const totalPressure = fact("P_total", "total-pressure");
const kpTarget = quantity("Kp", "calculate-result");

function totalMolesExpression(): ExpressionAst {
  return binary("ADD", variable(nN2O4), variable(nNO2));
}

function compressedKpExpression(): ExpressionAst {
  const total = totalMolesExpression();
  const pNO2 = binary(
    "MULTIPLY",
    binary("DIVIDE", variable(nNO2), total),
    variable(totalPressure),
  );
  const pN2O4 = binary(
    "MULTIPLY",
    binary("DIVIDE", variable(nN2O4), totalMolesExpression()),
    variable(totalPressure),
  );
  return binary("DIVIDE", binary("POWER", pNO2, number(2)), pN2O4);
}

function compressedCalculation(declaredResult: QuantityValue): EquationEvidence {
  return {
    target: kpTarget,
    expression: compressedKpExpression(),
    declaredResult,
  };
}

function wrongDependencyCalculation(): EquationEvidence {
  return {
    target: kpTarget,
    expression: binary(
      "DIVIDE",
      binary("POWER", variable(nNO2), number(2)),
      variable(nN2O4),
    ),
    declaredResult: result(0.9, undefined, 3, "0.900"),
  };
}

function relevantFacts(evidenceStepId: string): readonly FactUse[] {
  return [
    {
      factId: "equilibrium-moles-n2o4",
      observedValue: 0.4,
      unit: "mol",
      evidenceStepIds: [evidenceStepId],
    },
    {
      factId: "equilibrium-moles-no2",
      observedValue: 0.6,
      unit: "mol",
      evidenceStepIds: [evidenceStepId],
    },
    {
      factId: "total-pressure",
      observedValue: 500,
      unit: "kPa",
      evidenceStepIds: [evidenceStepId],
    },
    {
      factId: "required-precision",
      observedValue: 3,
      unit: "significant figures",
      evidenceStepIds: [evidenceStepId],
    },
  ];
}

function typedArtifact(id: string, modality: AttemptArtifact["modality"] = "TYPED_WORKING") {
  return {
    id,
    modality,
    mediaType: modality === "EXPLANATION" ? "text/plain" : "text/plain",
    contentRef: `gold://kp/${id}`,
  } satisfies AttemptArtifact;
}

function visualArtifact(
  id: string,
  modality: "HANDWRITING_IMAGE" | "DIGITAL_INK" = "HANDWRITING_IMAGE",
) {
  return {
    id,
    modality,
    mediaType: modality === "HANDWRITING_IMAGE" ? "image/png" : "application/json",
    pageCount: 1,
    contentRef: `gold://kp/${id}/page-1`,
  } satisfies AttemptArtifact;
}

function revision(
  id: string,
  sequence: number,
  stepIds: readonly string[],
  precededByAssistanceEventIds: readonly string[] = [],
): AttemptRevision {
  return {
    id,
    sequence,
    submittedAt,
    stepIds,
    precededByAssistanceEventIds,
  };
}

function compressedStep(
  id: string,
  revisionId: string,
  source: StepSource,
  recognition: RecognitionEvidence,
  declaredResult: QuantityValue = result(450, "kPa", 3, "4.50 × 10² kPa"),
): NormalizedStep {
  const renderedResult = declaredResult.raw ?? String(declaredResult.value);
  return {
    id,
    revisionId,
    source,
    rawTranscription:
      `Kp = [(0.600 / 1.000 × 500)²] / [(0.400 / 1.000 × 500)] = ${renderedResult}`,
    semanticType: "FINAL_ANSWER",
    concept: "KP_RESULT",
    formulaAst: kpFormulaAst,
    calculation: compressedCalculation(declaredResult),
    recognition,
  };
}

function simpleStep(
  id: string,
  revisionId: string,
  source: StepSource,
  rawTranscription: string,
  semanticType: NormalizedStep["semanticType"],
  concept: NormalizedStep["concept"],
): NormalizedStep {
  return {
    id,
    revisionId,
    source,
    rawTranscription,
    semanticType,
    concept,
    recognition: autoAccepted(),
  };
}

function explicitCorrectSteps(
  artifactId: string,
  revisionId: string,
  modality: "HANDWRITING_IMAGE" | "TYPED_WORKING" = "HANDWRITING_IMAGE",
): readonly NormalizedStep[] {
  const sourceAt = (span: string, y: number): StepSource =>
    modality === "HANDWRITING_IMAGE"
      ? visualSource(artifactId, modality, y)
      : textSource(artifactId, modality, span);
  const recognition = modality === "HANDWRITING_IMAGE" ? autoAccepted(0.99) : autoAccepted();

  return [
    {
      id: "data",
      revisionId,
      source: sourceAt("0:88", 0.06),
      rawTranscription:
        "Relevant: 0.400 mol N₂O₄, 0.600 mol NO₂, 500 kPa; answer to 3 s.f.; volume not needed",
      semanticType: "DATA_SELECTION",
      concept: null,
      recognition,
    },
    {
      id: "target",
      revisionId,
      source: sourceAt("89:96", 0.14),
      rawTranscription: "Find Kp",
      semanticType: "TARGET_IDENTIFICATION",
      concept: "KP_RESULT",
      recognition,
    },
    {
      id: "total",
      revisionId,
      source: sourceAt("97:139", 0.22),
      rawTranscription: "n(total) = 0.400 + 0.600 = 1.000 mol",
      semanticType: "ARITHMETIC",
      concept: "TOTAL_MOLES",
      calculation: {
        target: quantity("n_total", "total-moles"),
        expression: totalMolesExpression(),
        declaredResult: result(1, "mol", 4, "1.000 mol"),
      },
      recognition,
    },
    {
      id: "x-n2o4",
      revisionId,
      source: sourceAt("140:179", 0.3),
      rawTranscription: "x(N₂O₄) = 0.400 / 1.000 = 0.400",
      semanticType: "SUBSTITUTION",
      concept: "MOLE_FRACTION",
      calculation: {
        target: quantity("x_N2O4", "mole-fraction-n2o4"),
        expression: binary("DIVIDE", variable(nN2O4), variable(stepResult("n_total", "total"))),
        declaredResult: result(0.4, undefined, 3, "0.400"),
      },
      recognition,
    },
    {
      id: "x-no2",
      revisionId,
      source: sourceAt("180:216", 0.38),
      rawTranscription: "x(NO₂) = 0.600 / 1.000 = 0.600",
      semanticType: "SUBSTITUTION",
      concept: "MOLE_FRACTION",
      calculation: {
        target: quantity("x_NO2", "mole-fraction-no2"),
        expression: binary("DIVIDE", variable(nNO2), variable(stepResult("n_total", "total"))),
        declaredResult: result(0.6, undefined, 3, "0.600"),
      },
      recognition,
    },
    {
      id: "pp-n2o4",
      revisionId,
      source: sourceAt("217:262", 0.46),
      rawTranscription: "p(N₂O₄) = 0.400 × 500 = 200 kPa",
      semanticType: "SUBSTITUTION",
      concept: "PARTIAL_PRESSURE",
      calculation: {
        target: quantity("p_N2O4", "partial-pressure-n2o4"),
        expression: binary(
          "MULTIPLY",
          variable(stepResult("x_N2O4", "x-n2o4")),
          variable(totalPressure),
        ),
        declaredResult: result(200, "kPa", 3, "200 kPa (3 s.f.)"),
      },
      recognition,
    },
    {
      id: "pp-no2",
      revisionId,
      source: sourceAt("263:305", 0.54),
      rawTranscription: "p(NO₂) = 0.600 × 500 = 300 kPa",
      semanticType: "SUBSTITUTION",
      concept: "PARTIAL_PRESSURE",
      calculation: {
        target: quantity("p_NO2", "partial-pressure-no2"),
        expression: binary(
          "MULTIPLY",
          variable(stepResult("x_NO2", "x-no2")),
          variable(totalPressure),
        ),
        declaredResult: result(300, "kPa", 3, "300 kPa (3 s.f.)"),
      },
      recognition,
    },
    {
      id: "formula",
      revisionId,
      source: sourceAt("306:339", 0.62),
      rawTranscription: "Kp = p(NO₂)² / p(N₂O₄)",
      semanticType: "FORMULA",
      concept: "KP_EXPRESSION",
      formulaAst: kpFormulaAst,
      recognition,
    },
    {
      id: "final",
      revisionId,
      source: sourceAt("340:385", 0.7),
      rawTranscription: "Kp = 300² / 200 = 4.50 × 10² kPa",
      semanticType: "FINAL_ANSWER",
      concept: "KP_RESULT",
      formulaAst: kpFormulaAst,
      calculation: {
        target: kpTarget,
        expression: binary(
          "DIVIDE",
          binary("POWER", variable(stepResult("p_NO2", "pp-no2")), number(2)),
          variable(stepResult("p_N2O4", "pp-n2o4")),
        ),
        declaredResult: result(450, "kPa", 3, "4.50 × 10² kPa"),
      },
      recognition,
    },
  ];
}

const explicitStepIds = [
  "data",
  "target",
  "total",
  "x-n2o4",
  "x-no2",
  "pp-n2o4",
  "pp-no2",
  "formula",
  "final",
] as const;

export const completeHandwritingCorrect = {
  id: "HANDWRITING_COMPLETE_CORRECT",
  description: "Complete explicit handwriting with every calculation represented as an equation AST.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-handwriting-complete-correct",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "HANDWRITING_IMAGE",
    artifacts: [visualArtifact("page-complete")],
    factsUsed: relevantFacts("data"),
    target: { quantity: "KP", evidenceStepIds: ["target"], explicit: true },
    steps: explicitCorrectSteps("page-complete", "rev-1"),
    revisions: [revision("rev-1", 1, explicitStepIds)],
    finalAnswer: result(450, "kPa", 3, "4.50 × 10² kPa"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "SOLVED_INDEPENDENTLY",
    stageEvaluations: solvedStages(explicitStepIds),
  },
} as const satisfies NormalizedAttemptFixture;

export const compressedTypedCorrect = {
  id: "TYPED_COMPRESSED_CORRECT",
  description: "One complete calculation AST embeds every partial-pressure dependency.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-typed-compressed-correct",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("typed-compressed")],
    factsUsed: relevantFacts("working"),
    target: { quantity: "KP", evidenceStepIds: ["working"], explicit: false },
    steps: [
      compressedStep(
        "working",
        "rev-1",
        textSource("typed-compressed", "TYPED_WORKING", "0:89"),
        autoAccepted(),
      ),
    ],
    revisions: [revision("rev-1", 1, ["working"])],
    finalAnswer: result(450, "kPa", 3, "4.50 × 10² kPa"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "SOLVED_INDEPENDENTLY",
    stageEvaluations: solvedStages(["working"], "NOT_OBSERVED"),
  },
} as const satisfies NormalizedAttemptFixture;

export const explanationOnly = {
  id: "EXPLANATION_STRATEGY_ONLY",
  description: "Valid target, strategy, and formula without a calculation or final result.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-explanation-only",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "EXPLANATION",
    artifacts: [typedArtifact("explanation-only", "EXPLANATION")],
    factsUsed: [],
    target: { quantity: "KP", evidenceStepIds: ["explanation"], explicit: true },
    steps: [
      {
        ...simpleStep(
          "explanation",
          "rev-1",
          textSource("explanation-only", "EXPLANATION", "0:112"),
          "Find Kp. Use mole fractions and total pressure for partial pressures, then Kp = p(NO₂)² / p(N₂O₄).",
          "STRATEGY",
          "KP_EXPRESSION",
        ),
        formulaAst: kpFormulaAst,
      },
    ],
    revisions: [revision("rev-1", 1, ["explanation"])],
    finalAnswer: null,
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "INCOMPLETE_EVIDENCE",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["explanation"] },
      STRATEGY: { status: "CORRECT", evidenceStepIds: ["explanation"] },
      FORMULA: { status: "CORRECT", evidenceStepIds: ["explanation"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const invertedFormulaIncorrect = {
  id: "TYPED_INVERTED_FORMULA",
  description: "Correct partial pressures followed by an inverted Kp formula and calculation.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-inverted-formula",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("typed-inverted")],
    factsUsed: relevantFacts("inverted"),
    target: { quantity: "KP", evidenceStepIds: ["inverted"], explicit: true },
    steps: [
      {
        id: "inverted",
        revisionId: "rev-1",
        source: textSource("typed-inverted", "TYPED_WORKING", "0:66"),
        rawTranscription:
          "p(N₂O₄)=200, p(NO₂)=300; Kp=p(N₂O₄)/p(NO₂)²=0.00222 kPa⁻¹ (3 s.f.)",
        semanticType: "FINAL_ANSWER",
        concept: "KP_RESULT",
        formulaAst: binary(
          "DIVIDE",
          variable(quantity("p_N2O4", "partial-pressure-n2o4")),
          binary("POWER", variable(quantity("p_NO2", "partial-pressure-no2")), number(2)),
        ),
        calculation: {
          target: kpTarget,
          expression: binary("DIVIDE", number(200), binary("POWER", number(300), number(2))),
          declaredResult: result(0.00222, "kPa⁻¹", 3, "0.00222 kPa⁻¹ (3 s.f.)"),
        },
        recognition: autoAccepted(),
      },
    ],
    revisions: [revision("rev-1", 1, ["inverted"])],
    finalAnswer: result(0.00222, "kPa⁻¹", 3, "0.00222 kPa⁻¹ (3 s.f.)"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "INVERTED_RELATION",
    firstPedagogicalError: "FORMULA",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["inverted"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["inverted"] },
      STRATEGY: { status: "NOT_OBSERVED", evidenceStepIds: ["inverted"] },
      FORMULA: {
        status: "INCORRECT",
        failureCode: "INVERTED_RELATION",
        evidenceStepIds: ["inverted"],
      },
      SUBSTITUTION: { status: "DOWNSTREAM_AFFECTED", evidenceStepIds: ["inverted"] },
      ARITHMETIC: { status: "DOWNSTREAM_AFFECTED", evidenceStepIds: ["inverted"] },
      UNIT: { status: "DOWNSTREAM_AFFECTED", evidenceStepIds: ["inverted"] },
      PRECISION: { status: "CORRECT", evidenceStepIds: ["inverted"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const wrongDependencyIncorrect = {
  id: "TYPED_WRONG_SUBSTITUTION_DEPENDENCY",
  description: "Correct Kp relationship but equilibrium amounts are substituted for pressures.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-wrong-dependency",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("typed-wrong-dependency")],
    factsUsed: relevantFacts("wrong-substitution").slice(0, 2),
    target: { quantity: "KP", evidenceStepIds: ["wrong-substitution"], explicit: true },
    steps: [
      {
        id: "wrong-substitution",
        revisionId: "rev-1",
        source: textSource("typed-wrong-dependency", "TYPED_WORKING", "0:54"),
        rawTranscription: "Kp = p(NO₂)²/p(N₂O₄) = 0.600²/0.400 = 0.900",
        semanticType: "SUBSTITUTION",
        concept: "KP_RESULT",
        formulaAst: kpFormulaAst,
        calculation: wrongDependencyCalculation(),
        recognition: autoAccepted(),
      },
    ],
    revisions: [revision("rev-1", 1, ["wrong-substitution"])],
    finalAnswer: result(0.9, undefined, 3, "0.900"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "WRONG_DEPENDENCY_USED",
    firstPedagogicalError: "SUBSTITUTION",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["wrong-substitution"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["wrong-substitution"] },
      STRATEGY: { status: "NOT_OBSERVED", evidenceStepIds: ["wrong-substitution"] },
      FORMULA: { status: "CORRECT", evidenceStepIds: ["wrong-substitution"] },
      SUBSTITUTION: {
        status: "INCORRECT",
        failureCode: "WRONG_DEPENDENCY_USED",
        evidenceStepIds: ["wrong-substitution"],
      },
      ARITHMETIC: { status: "DOWNSTREAM_AFFECTED", evidenceStepIds: ["wrong-substitution"] },
      PRECISION: { status: "CORRECT", evidenceStepIds: ["wrong-substitution"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const handwritingRecognitionUncertain = {
  id: "HANDWRITING_RECOGNITION_UNCERTAIN",
  description: "A local 0.400/0.460 ambiguity blocks subject diagnosis.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-recognition-uncertain",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "HANDWRITING_IMAGE",
    artifacts: [visualArtifact("page-uncertain")],
    factsUsed: [],
    target: null,
    steps: [
      {
        id: "uncertain-working",
        revisionId: "rev-1",
        source: visualSource("page-uncertain", "HANDWRITING_IMAGE", 0.31),
        rawTranscription: "0.4?0 / 1.000 × 500",
        semanticType: "SUBSTITUTION",
        concept: "PARTIAL_PRESSURE",
        recognition: {
          status: "REQUIRES_CONFIRMATION",
          confidence: 0.78,
          candidates: [
            { transcription: "0.400 / 1.000 × 500", confidence: 0.78 },
            { transcription: "0.460 / 1.000 × 500", confidence: 0.74 },
          ],
        },
      },
    ],
    revisions: [revision("rev-1", 1, ["uncertain-working"])],
    finalAnswer: null,
    recognitionIssues: [
      {
        id: "recognition-issue-step-1",
        scope: "STEP",
        stepId: "uncertain-working",
        reason: "MULTIPLE_PLAUSIBLE_READINGS",
      },
    ],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "REQUIRES_CONFIRMATION",
    decision: "RECOGNITION_UNCERTAIN",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      STRATEGY: { status: "AMBIGUOUS_RECOGNITION", evidenceStepIds: ["uncertain-working"] },
      SUBSTITUTION: {
        status: "AMBIGUOUS_RECOGNITION",
        evidenceStepIds: ["uncertain-working"],
      },
    }).map((evaluation) =>
      evaluation.status === "NOT_OBSERVED"
        ? { ...evaluation, status: "NOT_EVALUATED" as const }
        : evaluation,
    ),
  },
} as const satisfies NormalizedAttemptFixture;

export const guidedSolvedAfterFormulaHint = {
  id: "GUIDED_SOLVED_AFTER_FORMULA_HINT",
  description: "A pre-hint incomplete revision is followed by a formula hint and a supported solution.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-guided-formula-hint",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "GUIDE_ME",
    modality: "MIXED",
    artifacts: [typedArtifact("guided-before", "STRUCTURED"), visualArtifact("guided-after", "DIGITAL_INK")],
    factsUsed: relevantFacts("after-hint"),
    target: { quantity: "KP", evidenceStepIds: ["before-hint"], explicit: true },
    steps: [
      simpleStep(
        "before-hint",
        "rev-1",
        textSource("guided-before", "STRUCTURED", "stage:formula"),
        "I have p(N₂O₄)=200 kPa and p(NO₂)=300 kPa but do not know the Kp formula.",
        "STRATEGY",
        "PARTIAL_PRESSURE",
      ),
      compressedStep(
        "after-hint",
        "rev-2",
        visualSource("guided-after", "DIGITAL_INK", 0.3),
        autoAccepted(0.99),
      ),
    ],
    revisions: [
      revision("rev-1", 1, ["before-hint"]),
      revision("rev-2", 3, ["after-hint"], ["assist-formula-1"]),
    ],
    finalAnswer: result(450, "kPa", 3, "4.50 × 10² kPa"),
    recognitionIssues: [],
    assistanceEvents: [
      {
        id: "assist-formula-1",
        sequence: 2,
        stage: "FORMULA",
        level: 3,
        hintId: "FORMULA-KP-01",
        trigger: "LEARNER_REQUEST",
        revealedReasoningNodeIds: ["construct-kp-expression"],
        revealedContentIds: ["formula-kp-no2-n2o4"],
        timestamp: "2026-07-14T07:59:30.000Z",
      },
    ],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "SOLVED_AFTER_FORMULA_HINT",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["after-hint"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["before-hint"] },
      STRATEGY: { status: "CORRECT", evidenceStepIds: ["before-hint", "after-hint"] },
      FORMULA: { status: "SUPPORTED_BY_HINT", evidenceStepIds: ["after-hint"] },
      SUBSTITUTION: { status: "CORRECT", evidenceStepIds: ["after-hint"] },
      ARITHMETIC: { status: "CORRECT", evidenceStepIds: ["after-hint"] },
      UNIT: { status: "CORRECT", evidenceStepIds: ["after-hint"] },
      PRECISION: { status: "CORRECT", evidenceStepIds: ["after-hint"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const dataIrrelevantVolumeUsed = {
  id: "DATA_IRRELEVANT_VOLUME_USED",
  description: "The learner explicitly selects vessel volume as necessary data.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-data-irrelevant-volume",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("data-volume")],
    factsUsed: [
      ...relevantFacts("data-selection"),
      {
        factId: "vessel-volume",
        observedValue: 2,
        unit: "dm³",
        evidenceStepIds: ["data-selection"],
      },
    ],
    target: { quantity: "KP", evidenceStepIds: ["data-selection"], explicit: true },
    steps: [
      simpleStep(
        "data-selection",
        "rev-1",
        textSource("data-volume", "TYPED_WORKING", "0:79"),
        "Required data: 0.400 mol, 0.600 mol, 500 kPa, and the 2.00 dm³ vessel volume.",
        "DATA_SELECTION",
        null,
      ),
    ],
    revisions: [revision("rev-1", 1, ["data-selection"])],
    finalAnswer: null,
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "IRRELEVANT_DATA_USED",
    firstPedagogicalError: "DATA_EXTRACTION",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: {
        status: "INCORRECT",
        failureCode: "IRRELEVANT_DATA_USED",
        evidenceStepIds: ["data-selection"],
      },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const targetMisidentifiedAsKc = {
  id: "TARGET_MISIDENTIFIED_AS_KC",
  description: "The learner explicitly identifies Kc instead of Kp as the target.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-target-kc",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("target-kc")],
    factsUsed: [],
    target: { quantity: "KC", evidenceStepIds: ["target-kc-step"], explicit: true },
    steps: [
      simpleStep(
        "target-kc-step",
        "rev-1",
        textSource("target-kc", "TYPED_WORKING", "0:17"),
        "I need to find Kc.",
        "TARGET_IDENTIFICATION",
        null,
      ),
    ],
    revisions: [revision("rev-1", 1, ["target-kc-step"])],
    finalAnswer: null,
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "TARGET_MISIDENTIFIED",
    firstPedagogicalError: "TARGET_IDENTIFICATION",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      TARGET_IDENTIFICATION: {
        status: "INCORRECT",
        failureCode: "TARGET_MISIDENTIFIED",
        evidenceStepIds: ["target-kc-step"],
      },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const strategyUsesConcentrationRoute = {
  id: "STRATEGY_USES_CONCENTRATION_ROUTE",
  description: "The learner chooses an unsupported concentration/Kc route for the authored Kp policy.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-strategy-concentration",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "EXPLANATION",
    artifacts: [typedArtifact("strategy-concentration", "EXPLANATION")],
    factsUsed: [],
    target: { quantity: "KP", evidenceStepIds: ["strategy-step"], explicit: true },
    steps: [
      simpleStep(
        "strategy-step",
        "rev-1",
        textSource("strategy-concentration", "EXPLANATION", "0:72"),
        "I will divide moles by 2.00 dm³, calculate Kc, and report that as Kp.",
        "STRATEGY",
        "KP_RESULT",
      ),
    ],
    revisions: [revision("rev-1", 1, ["strategy-step"])],
    finalAnswer: null,
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "WRONG_METHOD",
    firstPedagogicalError: "STRATEGY",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["strategy-step"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["strategy-step"] },
      STRATEGY: {
        status: "INCORRECT",
        failureCode: "WRONG_METHOD",
        evidenceStepIds: ["strategy-step"],
      },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const arithmeticErrorAfterCorrectSubstitution = {
  id: "ARITHMETIC_ERROR_AFTER_CORRECT_SUBSTITUTION",
  description: "The structured substitution is correct but the declared arithmetic result is 400 kPa.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-arithmetic-error",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("arithmetic-error")],
    factsUsed: relevantFacts("arithmetic-step"),
    target: { quantity: "KP", evidenceStepIds: ["arithmetic-step"], explicit: true },
    steps: [
      compressedStep(
        "arithmetic-step",
        "rev-1",
        textSource("arithmetic-error", "TYPED_WORKING", "0:85"),
        autoAccepted(),
        result(400, "kPa", 3, "4.00 × 10² kPa"),
      ),
    ],
    revisions: [revision("rev-1", 1, ["arithmetic-step"])],
    finalAnswer: result(400, "kPa", 3, "4.00 × 10² kPa"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "ARITHMETIC_ERROR",
    firstPedagogicalError: "ARITHMETIC",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["arithmetic-step"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["arithmetic-step"] },
      STRATEGY: { status: "CORRECT", evidenceStepIds: ["arithmetic-step"] },
      FORMULA: { status: "CORRECT", evidenceStepIds: ["arithmetic-step"] },
      SUBSTITUTION: { status: "CORRECT", evidenceStepIds: ["arithmetic-step"] },
      ARITHMETIC: {
        status: "INCORRECT",
        failureCode: "ARITHMETIC_ERROR",
        evidenceStepIds: ["arithmetic-step"],
      },
      UNIT: { status: "CORRECT", evidenceStepIds: ["arithmetic-step"] },
      PRECISION: { status: "CORRECT", evidenceStepIds: ["arithmetic-step"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const finalUnitError = {
  id: "FINAL_UNIT_ERROR",
  description: "All structured calculation evidence is correct except the final unit.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-unit-error",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("unit-error")],
    factsUsed: relevantFacts("unit-step"),
    target: { quantity: "KP", evidenceStepIds: ["unit-step"], explicit: true },
    steps: [
      compressedStep(
        "unit-step",
        "rev-1",
        textSource("unit-error", "TYPED_WORKING", "0:83"),
        autoAccepted(),
        result(450, "mol", 3, "4.50 × 10² mol"),
      ),
    ],
    revisions: [revision("rev-1", 1, ["unit-step"])],
    finalAnswer: result(450, "mol", 3, "4.50 × 10² mol"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "UNIT_ERROR",
    firstPedagogicalError: "UNIT",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["unit-step"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["unit-step"] },
      STRATEGY: { status: "CORRECT", evidenceStepIds: ["unit-step"] },
      FORMULA: { status: "CORRECT", evidenceStepIds: ["unit-step"] },
      SUBSTITUTION: { status: "CORRECT", evidenceStepIds: ["unit-step"] },
      ARITHMETIC: { status: "CORRECT", evidenceStepIds: ["unit-step"] },
      UNIT: { status: "INCORRECT", failureCode: "UNIT_ERROR", evidenceStepIds: ["unit-step"] },
      PRECISION: { status: "CORRECT", evidenceStepIds: ["unit-step"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const finalPrecisionError = {
  id: "FINAL_PRECISION_ERROR",
  description: "The correct value and unit are reported unambiguously to two significant figures.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-precision-error",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [typedArtifact("precision-error")],
    factsUsed: relevantFacts("precision-step"),
    target: { quantity: "KP", evidenceStepIds: ["precision-step"], explicit: true },
    steps: [
      compressedStep(
        "precision-step",
        "rev-1",
        textSource("precision-error", "TYPED_WORKING", "0:82"),
        autoAccepted(),
        result(450, "kPa", 2, "4.5 × 10² kPa"),
      ),
    ],
    revisions: [revision("rev-1", 1, ["precision-step"])],
    finalAnswer: result(450, "kPa", 2, "4.5 × 10² kPa"),
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "STUDENT_ERROR",
    failureCode: "SIGNIFICANT_FIGURES_ERROR",
    firstPedagogicalError: "PRECISION",
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({
      DATA_EXTRACTION: { status: "NOT_OBSERVED", evidenceStepIds: ["precision-step"] },
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["precision-step"] },
      STRATEGY: { status: "CORRECT", evidenceStepIds: ["precision-step"] },
      FORMULA: { status: "CORRECT", evidenceStepIds: ["precision-step"] },
      SUBSTITUTION: { status: "CORRECT", evidenceStepIds: ["precision-step"] },
      ARITHMETIC: { status: "CORRECT", evidenceStepIds: ["precision-step"] },
      UNIT: { status: "CORRECT", evidenceStepIds: ["precision-step"] },
      PRECISION: {
        status: "INCORRECT",
        failureCode: "SIGNIFICANT_FIGURES_ERROR",
        evidenceStepIds: ["precision-step"],
      },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const handwritingBelowThresholdAbstain = {
  id: "HANDWRITING_BELOW_THRESHOLD_ABSTAIN",
  description: "Whole-page quality is below the confirmation threshold before step segmentation.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-below-threshold",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "HANDWRITING_IMAGE",
    artifacts: [visualArtifact("page-illegible")],
    factsUsed: [],
    target: null,
    steps: [],
    revisions: [],
    finalAnswer: null,
    recognitionIssues: [
      {
        id: "recognition-issue-artifact-1",
        scope: "ARTIFACT",
        artifactId: "page-illegible",
        reason: "ILLEGIBLE",
        recognition: {
          status: "ABSTAINED",
          confidence: 0.42,
          reason: "The page is too blurred to segment calculation steps safely.",
        },
      },
    ],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "ABSTAINED",
    decision: "RECOGNITION_UNCERTAIN",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: stages({}).map((evaluation) => ({
      ...evaluation,
      status: "NOT_EVALUATED" as const,
    })),
  },
} as const satisfies NormalizedAttemptFixture;

export const handwritingConfirmedThenDiagnosed = {
  id: "HANDWRITING_CONFIRMED_THEN_DIAGNOSED",
  description: "A local ambiguity is student-confirmed before the complete calculation is diagnosed.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-confirmed-then-diagnosed",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "HANDWRITING_IMAGE",
    artifacts: [visualArtifact("page-confirmed")],
    factsUsed: relevantFacts("confirmed-working"),
    target: { quantity: "KP", evidenceStepIds: ["confirmed-working"], explicit: false },
    steps: [
      compressedStep(
        "confirmed-working",
        "rev-1",
        visualSource("page-confirmed", "HANDWRITING_IMAGE", 0.28),
        {
          status: "STUDENT_CONFIRMED",
          confidence: 0.78,
          selectedTranscription:
            "Kp = [(0.600 / 1.000 × 500)²] / [(0.400 / 1.000 × 500)] = 4.50 × 10² kPa",
          candidates: [
            {
              transcription:
                "Kp = [(0.600 / 1.000 × 500)²] / [(0.400 / 1.000 × 500)] = 4.50 × 10² kPa",
              confidence: 0.78,
            },
            {
              transcription:
                "Kp = [(0.600 / 1.000 × 500)²] / [(0.460 / 1.000 × 500)] = 4.50 × 10² kPa",
              confidence: 0.74,
            },
          ],
        },
      ),
    ],
    revisions: [revision("rev-1", 1, ["confirmed-working"])],
    finalAnswer: result(450, "kPa", 3, "4.50 × 10² kPa"),
    recognitionIssues: [
      {
        id: "recognition-issue-confirmed-1",
        scope: "STEP",
        stepId: "confirmed-working",
        reason: "MULTIPLE_PLAUSIBLE_READINGS",
      },
    ],
    assistanceEvents: [],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    attemptSupportOutcome: "SOLVED_INDEPENDENTLY",
    stageEvaluations: solvedStages(["confirmed-working"], "NOT_OBSERVED"),
  },
} as const satisfies NormalizedAttemptFixture;

export const guidedNotSolvedAfterFullScaffold = {
  id: "GUIDED_NOT_SOLVED_AFTER_FULL_SCAFFOLD",
  description: "A level-4 scaffold precedes a second revision that still uses the wrong dependency.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-guided-not-solved",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "GUIDE_ME",
    modality: "STRUCTURED",
    artifacts: [typedArtifact("guided-full-scaffold", "STRUCTURED")],
    factsUsed: relevantFacts("after-scaffold").slice(0, 2),
    target: { quantity: "KP", evidenceStepIds: ["before-scaffold"], explicit: true },
    steps: [
      simpleStep(
        "before-scaffold",
        "rev-1",
        textSource("guided-full-scaffold", "STRUCTURED", "revision:1"),
        "I know I must find Kp, but I am not sure how to begin.",
        "STRATEGY",
        null,
      ),
      {
        id: "after-scaffold",
        revisionId: "rev-2",
        source: textSource("guided-full-scaffold", "STRUCTURED", "revision:2"),
        rawTranscription: "Kp = p(NO₂)²/p(N₂O₄) = 0.600²/0.400 = 0.900",
        semanticType: "SUBSTITUTION",
        concept: "KP_RESULT",
        formulaAst: kpFormulaAst,
        calculation: wrongDependencyCalculation(),
        recognition: autoAccepted(),
      },
    ],
    revisions: [
      revision("rev-1", 1, ["before-scaffold"]),
      revision("rev-2", 3, ["after-scaffold"], ["assist-scaffold-1"]),
    ],
    finalAnswer: result(0.9, undefined, 3, "0.900"),
    recognitionIssues: [],
    assistanceEvents: [
      {
        id: "assist-scaffold-1",
        sequence: 2,
        stage: "SUBSTITUTION",
        level: 4,
        hintId: "FULL-SCAFFOLD-KP-01",
        trigger: "CONSECUTIVE_FAILURES",
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
        timestamp: "2026-07-14T07:59:30.000Z",
      },
    ],
  },
  expected: {
    recognitionGateDecision: "PASSED",
    decision: "NOT_SOLVED",
    failureCode: "WRONG_DEPENDENCY_USED",
    firstPedagogicalError: "SUBSTITUTION",
    attemptSupportOutcome: "NOT_SOLVED_AFTER_FULL_SCAFFOLD",
    stageEvaluations: stages({
      TARGET_IDENTIFICATION: { status: "CORRECT", evidenceStepIds: ["before-scaffold"] },
      STRATEGY: { status: "SUPPORTED_BY_HINT", evidenceStepIds: ["after-scaffold"] },
      FORMULA: { status: "SUPPORTED_BY_HINT", evidenceStepIds: ["after-scaffold"] },
      SUBSTITUTION: {
        status: "INCORRECT",
        failureCode: "WRONG_DEPENDENCY_USED",
        evidenceStepIds: ["after-scaffold"],
      },
      ARITHMETIC: { status: "DOWNSTREAM_AFFECTED", evidenceStepIds: ["after-scaffold"] },
      PRECISION: { status: "CORRECT", evidenceStepIds: ["after-scaffold"] },
    }),
  },
} as const satisfies NormalizedAttemptFixture;

export const kpNormalizedAttemptFixtures = Object.freeze([
  completeHandwritingCorrect,
  compressedTypedCorrect,
  explanationOnly,
  invertedFormulaIncorrect,
  wrongDependencyIncorrect,
  handwritingRecognitionUncertain,
  guidedSolvedAfterFormulaHint,
  dataIrrelevantVolumeUsed,
  targetMisidentifiedAsKc,
  strategyUsesConcentrationRoute,
  arithmeticErrorAfterCorrectSubstitution,
  finalUnitError,
  finalPrecisionError,
  handwritingBelowThresholdAbstain,
  handwritingConfirmedThenDiagnosed,
  guidedNotSolvedAfterFullScaffold,
] as const satisfies readonly NormalizedAttemptFixture[]);

export const kpGoldFixtureMetadata = Object.freeze({
  problemId: kpGoldProblemV2.id,
  problemVersion: kpGoldProblemV2.version,
  contractVersion: V2_CONTRACT_VERSION,
  authoredAt: submittedAt,
  fixtureCount: kpNormalizedAttemptFixtures.length,
});
