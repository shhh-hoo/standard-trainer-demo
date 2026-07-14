import {
  V2_CONTRACT_VERSION,
  type DiagnosisCategory,
  type DiagnosisFailureCode,
  type EvaluationStatus,
  type ExpectedStageEvaluation,
  type ExpressionAst,
  type NormalizedAttemptFixture,
  type StepSource,
  type FactUse,
} from "../../domain/v2/types";
import { kpGoldProblemV2 } from "./kpGoldProblem";

const submittedAt = "2026-07-14T08:00:00.000Z";

function source(
  artifactId: string,
  modality: StepSource["modality"],
  textSpan: string,
  boundingBox?: StepSource["boundingBox"],
): StepSource {
  return {
    artifactId,
    modality,
    textSpan,
    ...(boundingBox ? { page: 1, boundingBox } : {}),
  };
}

function stage(
  category: DiagnosisCategory,
  status: EvaluationStatus,
  failureCode: DiagnosisFailureCode | null,
  evidenceStepIds: readonly string[] = [],
): ExpectedStageEvaluation {
  return { category, status, failureCode, evidenceStepIds };
}

const correctFormulaAst = {
  kind: "BINARY",
  operator: "DIVIDE",
  left: {
    kind: "BINARY",
    operator: "POWER",
    left: { kind: "VARIABLE", symbol: "p_NO2" },
    right: { kind: "NUMBER", value: 2, raw: "2" },
  },
  right: { kind: "VARIABLE", symbol: "p_N2O4" },
} as const satisfies ExpressionAst;

const invertedFormulaAst = {
  kind: "BINARY",
  operator: "DIVIDE",
  left: { kind: "VARIABLE", symbol: "p_N2O4" },
  right: {
    kind: "BINARY",
    operator: "POWER",
    left: { kind: "VARIABLE", symbol: "p_NO2" },
    right: { kind: "NUMBER", value: 2, raw: "2" },
  },
} as const satisfies ExpressionAst;

function requiredFacts(
  evidenceStepId: string,
  precisionEvidenceStepId = evidenceStepId,
): readonly FactUse[] {
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
      evidenceStepIds: [precisionEvidenceStepId],
    },
  ];
}

const allCorrectStages = (evidenceStepIds: readonly string[]) => [
  stage("DATA_EXTRACTION", "CORRECT", null, evidenceStepIds),
  stage("TARGET_IDENTIFICATION", "CORRECT", null, evidenceStepIds),
  stage("STRATEGY", "CORRECT", null, evidenceStepIds),
  stage("FORMULA", "CORRECT", null, evidenceStepIds),
  stage("SUBSTITUTION", "CORRECT", null, evidenceStepIds),
  stage("ARITHMETIC", "CORRECT", null, evidenceStepIds),
  stage("UNIT", "CORRECT", null, evidenceStepIds),
  stage("PRECISION", "CORRECT", null, evidenceStepIds),
];

export const completeHandwritingCorrect = {
  id: "HANDWRITING_COMPLETE_CORRECT",
  description:
    "A complete handwriting image with explicit data selection and each dependency visible.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-handwriting-complete-correct",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "HANDWRITING_IMAGE",
    artifacts: [
      {
        id: "page-1",
        modality: "HANDWRITING_IMAGE",
        mediaType: "image/png",
        pageCount: 1,
        contentRef: "gold://kp/handwriting-complete-correct/page-1",
      },
    ],
    factsUsed: [
      {
        factId: "equilibrium-moles-n2o4",
        observedValue: 0.4,
        unit: "mol",
        evidenceStepIds: ["data"],
      },
      {
        factId: "equilibrium-moles-no2",
        observedValue: 0.6,
        unit: "mol",
        evidenceStepIds: ["data"],
      },
      {
        factId: "total-pressure",
        observedValue: 500,
        unit: "kPa",
        evidenceStepIds: ["data", "pp-n2o4", "pp-no2"],
      },
      {
        factId: "required-precision",
        observedValue: 3,
        unit: "significant figures",
        evidenceStepIds: ["data", "final"],
      },
    ],
    target: { quantity: "KP", evidenceStepIds: ["target"], explicit: true },
    steps: [
      {
        id: "data",
        source: source("page-1", "HANDWRITING_IMAGE", "0.400 mol N2O4, 0.600 mol NO2, Ptotal = 500 kPa, 3 sf", {
          x: 0.08,
          y: 0.08,
          width: 0.78,
          height: 0.08,
          coordinateSpace: "NORMALIZED_0_TO_1",
        }),
        rawTranscription:
          "Relevant: 0.400 mol N₂O₄, 0.600 mol NO₂, Ptotal = 500 kPa; answer to 3 s.f.",
        semanticType: "DATA_SELECTION",
        concept: null,
        recognitionConfidence: 0.99,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
      {
        id: "target",
        source: source("page-1", "HANDWRITING_IMAGE", "Find Kp", {
          x: 0.08,
          y: 0.17,
          width: 0.2,
          height: 0.05,
          coordinateSpace: "NORMALIZED_0_TO_1",
        }),
        rawTranscription: "Find Kp",
        semanticType: "TARGET_IDENTIFICATION",
        concept: "KP_RESULT",
        recognitionConfidence: 0.99,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
      {
        id: "total",
        source: source("page-1", "HANDWRITING_IMAGE", "ntotal = 0.400 + 0.600 = 1.000 mol"),
        rawTranscription: "n(total) = 0.400 + 0.600 = 1.000 mol",
        semanticType: "ARITHMETIC",
        concept: "TOTAL_MOLES",
        declaredResult: 1,
        unit: "mol",
        recognitionConfidence: 0.99,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
      {
        id: "pp-n2o4",
        source: source("page-1", "HANDWRITING_IMAGE", "p(N2O4) = 0.400/1.000 x 500 = 200 kPa"),
        rawTranscription: "p(N₂O₄) = 0.400 / 1.000 × 500 = 200 kPa",
        semanticType: "SUBSTITUTION",
        concept: "PARTIAL_PRESSURE",
        declaredResult: 200,
        unit: "kPa",
        recognitionConfidence: 0.98,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
      {
        id: "pp-no2",
        source: source("page-1", "HANDWRITING_IMAGE", "p(NO2) = 0.600/1.000 x 500 = 300 kPa"),
        rawTranscription: "p(NO₂) = 0.600 / 1.000 × 500 = 300 kPa",
        semanticType: "SUBSTITUTION",
        concept: "PARTIAL_PRESSURE",
        declaredResult: 300,
        unit: "kPa",
        recognitionConfidence: 0.98,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
      {
        id: "formula",
        source: source("page-1", "HANDWRITING_IMAGE", "Kp = p(NO2)^2 / p(N2O4)"),
        rawTranscription: "Kp = p(NO₂)² / p(N₂O₄)",
        semanticType: "FORMULA",
        concept: "KP_EXPRESSION",
        expressionAst: correctFormulaAst,
        recognitionConfidence: 0.99,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
      {
        id: "final",
        source: source("page-1", "HANDWRITING_IMAGE", "Kp = 300^2/200 = 450 kPa"),
        rawTranscription: "Kp = 300² / 200 = 450 kPa",
        semanticType: "FINAL_ANSWER",
        concept: "KP_RESULT",
        inputs: [
          { symbol: "p_NO2", refersTo: "partial-pressure-no2", sourceStepId: "pp-no2" },
          { symbol: "p_N2O4", refersTo: "partial-pressure-n2o4", sourceStepId: "pp-n2o4" },
        ],
        declaredResult: 450,
        unit: "kPa",
        significantFigures: 3,
        recognitionConfidence: 0.99,
        recognitionStatus: "ABOVE_AUTHORED_THRESHOLD",
        ambiguities: [],
        studentConfirmed: false,
      },
    ],
    finalAnswer: { value: 450, unit: "kPa", significantFigures: 3 },
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    masteryOutcome: "SOLVED_INDEPENDENTLY",
    stageEvaluations: allCorrectStages([
      "data",
      "target",
      "total",
      "pp-n2o4",
      "pp-no2",
      "formula",
      "final",
    ]),
  },
} as const satisfies NormalizedAttemptFixture;

export const compressedTypedCorrect = {
  id: "TYPED_COMPRESSED_CORRECT",
  description:
    "One typed line embeds partial-pressure derivation, Kp formula, substitution, arithmetic, unit, and precision.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-typed-compressed-correct",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [
      {
        id: "typed-1",
        modality: "TYPED_WORKING",
        mediaType: "text/plain",
        contentRef: "gold://kp/typed-compressed-correct",
      },
    ],
    factsUsed: requiredFacts("working"),
    target: { quantity: "KP", evidenceStepIds: ["working"], explicit: false },
    steps: [
      {
        id: "working",
        source: source(
          "typed-1",
          "TYPED_WORKING",
          "Kp = [(0.600 / 1.000 x 500)^2] / [(0.400 / 1.000 x 500)] = 450 kPa",
        ),
        rawTranscription:
          "Kp = [(0.600 / 1.000 × 500)²] / [(0.400 / 1.000 × 500)] = 450 kPa",
        semanticType: "FINAL_ANSWER",
        concept: "KP_RESULT",
        expressionAst: correctFormulaAst,
        inputs: [
          { symbol: "n_NO2", refersTo: "equilibrium-moles-no2" },
          { symbol: "n_N2O4", refersTo: "equilibrium-moles-n2o4" },
          { symbol: "P_total", refersTo: "total-pressure" },
        ],
        declaredResult: 450,
        unit: "kPa",
        significantFigures: 3,
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
    ],
    finalAnswer: { value: 450, unit: "kPa", significantFigures: 3 },
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    masteryOutcome: "SOLVED_INDEPENDENTLY",
    stageEvaluations: [
      stage("DATA_EXTRACTION", "NOT_OBSERVED", null, ["working"]),
      stage("TARGET_IDENTIFICATION", "CORRECT", null, ["working"]),
      stage("STRATEGY", "CORRECT", null, ["working"]),
      stage("FORMULA", "CORRECT", null, ["working"]),
      stage("SUBSTITUTION", "CORRECT", null, ["working"]),
      stage("ARITHMETIC", "CORRECT", null, ["working"]),
      stage("UNIT", "CORRECT", null, ["working"]),
      stage("PRECISION", "CORRECT", null, ["working"]),
    ],
  },
} as const satisfies NormalizedAttemptFixture;

export const explanationOnly = {
  id: "EXPLANATION_STRATEGY_ONLY",
  description:
    "The learner explains a valid strategy and formula but provides no substitution or result.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-explanation-only",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "EXPLANATION",
    artifacts: [
      {
        id: "explanation-1",
        modality: "EXPLANATION",
        mediaType: "text/plain",
        contentRef: "gold://kp/explanation-strategy-only",
      },
    ],
    factsUsed: [],
    target: { quantity: "KP", evidenceStepIds: ["explanation"], explicit: true },
    steps: [
      {
        id: "explanation",
        source: source(
          "explanation-1",
          "EXPLANATION",
          "Find Kp. Use mole fractions and total pressure for partial pressures, then p(NO2)^2 / p(N2O4).",
        ),
        rawTranscription:
          "Find Kp. Use mole fractions and total pressure for partial pressures, then Kp = p(NO₂)² / p(N₂O₄).",
        semanticType: "STRATEGY",
        concept: "KP_EXPRESSION",
        expressionAst: correctFormulaAst,
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
    ],
    finalAnswer: null,
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    decision: "INCOMPLETE_EVIDENCE",
    failureCode: null,
    firstPedagogicalError: null,
    masteryOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: [
      stage("DATA_EXTRACTION", "NOT_OBSERVED", null),
      stage("TARGET_IDENTIFICATION", "CORRECT", null, ["explanation"]),
      stage("STRATEGY", "CORRECT", null, ["explanation"]),
      stage("FORMULA", "CORRECT", null, ["explanation"]),
      stage("SUBSTITUTION", "NOT_OBSERVED", null),
      stage("ARITHMETIC", "NOT_OBSERVED", null),
      stage("UNIT", "NOT_OBSERVED", null),
      stage("PRECISION", "NOT_OBSERVED", null),
    ],
  },
} as const satisfies NormalizedAttemptFixture;

export const invertedFormulaIncorrect = {
  id: "TYPED_INVERTED_FORMULA",
  description: "The learner derives correct partial pressures but inverts the Kp relation.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-typed-inverted-formula",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [
      {
        id: "typed-2",
        modality: "TYPED_WORKING",
        mediaType: "text/plain",
        contentRef: "gold://kp/typed-inverted-formula",
      },
    ],
    factsUsed: requiredFacts("partial-pressures", "formula-wrong"),
    target: { quantity: "KP", evidenceStepIds: ["formula-wrong"], explicit: true },
    steps: [
      {
        id: "partial-pressures",
        source: source("typed-2", "TYPED_WORKING", "p(N2O4) = 200 kPa; p(NO2) = 300 kPa"),
        rawTranscription: "p(N₂O₄) = 200 kPa; p(NO₂) = 300 kPa",
        semanticType: "ARITHMETIC",
        concept: "PARTIAL_PRESSURE",
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
      {
        id: "formula-wrong",
        source: source("typed-2", "TYPED_WORKING", "Kp = p(N2O4) / p(NO2)^2"),
        rawTranscription: "Kp = p(N₂O₄) / p(NO₂)² = 200 / 300²",
        semanticType: "SUBSTITUTION",
        concept: "KP_EXPRESSION",
        expressionAst: invertedFormulaAst,
        declaredResult: 0.00222,
        unit: "kPa⁻¹",
        significantFigures: 3,
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
    ],
    finalAnswer: { value: 0.00222, unit: "kPa⁻¹", significantFigures: 3 },
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    decision: "STUDENT_ERROR",
    failureCode: "INVERTED_RELATION",
    firstPedagogicalError: "FORMULA",
    masteryOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: [
      stage("DATA_EXTRACTION", "NOT_OBSERVED", null, ["partial-pressures"]),
      stage("TARGET_IDENTIFICATION", "CORRECT", null, ["formula-wrong"]),
      stage("STRATEGY", "CORRECT", null, ["partial-pressures"]),
      stage("FORMULA", "INCORRECT", "INVERTED_RELATION", ["formula-wrong"]),
      stage("SUBSTITUTION", "DOWNSTREAM_AFFECTED", null, ["formula-wrong"]),
      stage("ARITHMETIC", "DOWNSTREAM_AFFECTED", null, ["formula-wrong"]),
      stage("UNIT", "DOWNSTREAM_AFFECTED", null, ["formula-wrong"]),
      stage("PRECISION", "CORRECT", null, ["formula-wrong"]),
    ],
  },
} as const satisfies NormalizedAttemptFixture;

export const wrongDependencyIncorrect = {
  id: "TYPED_WRONG_SUBSTITUTION_DEPENDENCY",
  description:
    "The learner writes the correct Kp formula but substitutes equilibrium amounts instead of partial pressures.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-typed-wrong-dependency",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "TYPED_WORKING",
    artifacts: [
      {
        id: "typed-3",
        modality: "TYPED_WORKING",
        mediaType: "text/plain",
        contentRef: "gold://kp/typed-wrong-substitution-dependency",
      },
    ],
    factsUsed: requiredFacts("wrong-substitution").slice(0, 2),
    target: { quantity: "KP", evidenceStepIds: ["wrong-substitution"], explicit: true },
    steps: [
      {
        id: "formula-correct",
        source: source("typed-3", "TYPED_WORKING", "Kp = p(NO2)^2 / p(N2O4)"),
        rawTranscription: "Kp = p(NO₂)² / p(N₂O₄)",
        semanticType: "FORMULA",
        concept: "KP_EXPRESSION",
        expressionAst: correctFormulaAst,
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
      {
        id: "wrong-substitution",
        source: source("typed-3", "TYPED_WORKING", "Kp = 0.600^2 / 0.400 = 0.900"),
        rawTranscription: "Kp = 0.600² / 0.400 = 0.900",
        semanticType: "SUBSTITUTION",
        concept: "KP_RESULT",
        inputs: [
          { symbol: "n_NO2", refersTo: "equilibrium-moles-no2" },
          { symbol: "n_N2O4", refersTo: "equilibrium-moles-n2o4" },
        ],
        declaredResult: 0.9,
        significantFigures: 3,
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
    ],
    finalAnswer: { value: 0.9, significantFigures: 3 },
    recognitionIssues: [],
    assistanceEvents: [],
  },
  expected: {
    decision: "STUDENT_ERROR",
    failureCode: "WRONG_DEPENDENCY_USED",
    firstPedagogicalError: "SUBSTITUTION",
    masteryOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: [
      stage("DATA_EXTRACTION", "NOT_OBSERVED", null, ["wrong-substitution"]),
      stage("TARGET_IDENTIFICATION", "CORRECT", null, ["wrong-substitution"]),
      stage("STRATEGY", "NOT_OBSERVED", null, ["wrong-substitution"]),
      stage("FORMULA", "CORRECT", null, ["formula-correct"]),
      stage("SUBSTITUTION", "INCORRECT", "WRONG_DEPENDENCY_USED", ["wrong-substitution"]),
      stage("ARITHMETIC", "DOWNSTREAM_AFFECTED", null, ["wrong-substitution"]),
      stage("UNIT", "NOT_OBSERVED", null),
      stage("PRECISION", "CORRECT", null, ["wrong-substitution"]),
    ],
  },
} as const satisfies NormalizedAttemptFixture;

export const handwritingRecognitionUncertain = {
  id: "HANDWRITING_RECOGNITION_UNCERTAIN",
  description:
    "A handwriting region could be 0.400 or 0.460, so chemistry diagnosis must abstain until local confirmation.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-handwriting-recognition-uncertain",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "TRY_IT_YOURSELF",
    modality: "HANDWRITING_IMAGE",
    artifacts: [
      {
        id: "page-uncertain",
        modality: "HANDWRITING_IMAGE",
        mediaType: "image/jpeg",
        pageCount: 1,
        contentRef: "gold://kp/handwriting-recognition-uncertain/page-1",
      },
    ],
    factsUsed: [],
    target: { quantity: "KP", evidenceStepIds: ["uncertain-working"], explicit: false },
    steps: [
      {
        id: "uncertain-working",
        source: source("page-uncertain", "HANDWRITING_IMAGE", "0.4?0 / 1.000 x 500", {
          x: 0.22,
          y: 0.31,
          width: 0.3,
          height: 0.09,
          coordinateSpace: "NORMALIZED_0_TO_1",
        }),
        rawTranscription: "0.4?0 / 1.000 × 500",
        semanticType: "SUBSTITUTION",
        concept: "PARTIAL_PRESSURE",
        recognitionConfidence: 0.78,
        recognitionStatus: "REQUIRES_CONFIRMATION",
        ambiguities: [
          { transcription: "0.400 / 1.000 × 500", confidence: 0.78 },
          { transcription: "0.460 / 1.000 × 500", confidence: 0.74 },
        ],
        studentConfirmed: false,
      },
    ],
    finalAnswer: null,
    recognitionIssues: [
      {
        id: "recognition-issue-1",
        stepId: "uncertain-working",
        source: source("page-uncertain", "HANDWRITING_IMAGE", "0.4?0", {
          x: 0.22,
          y: 0.31,
          width: 0.1,
          height: 0.09,
          coordinateSpace: "NORMALIZED_0_TO_1",
        }),
        reason: "MULTIPLE_PLAUSIBLE_READINGS",
        candidates: [
          { transcription: "0.400", confidence: 0.78 },
          { transcription: "0.460", confidence: 0.74 },
        ],
        status: "OPEN",
      },
    ],
    assistanceEvents: [],
  },
  expected: {
    decision: "RECOGNITION_UNCERTAIN",
    failureCode: null,
    firstPedagogicalError: null,
    masteryOutcome: "INSUFFICIENT_EVIDENCE",
    stageEvaluations: [
      stage("DATA_EXTRACTION", "NOT_EVALUATED", null),
      stage("TARGET_IDENTIFICATION", "NOT_EVALUATED", null),
      stage("STRATEGY", "AMBIGUOUS_RECOGNITION", null, ["uncertain-working"]),
      stage("FORMULA", "NOT_EVALUATED", null),
      stage("SUBSTITUTION", "AMBIGUOUS_RECOGNITION", null, ["uncertain-working"]),
      stage("ARITHMETIC", "NOT_EVALUATED", null),
      stage("UNIT", "NOT_EVALUATED", null),
      stage("PRECISION", "NOT_EVALUATED", null),
    ],
  },
} as const satisfies NormalizedAttemptFixture;

export const guidedSolvedAfterFormulaHint = {
  id: "GUIDED_SOLVED_AFTER_FORMULA_HINT",
  description:
    "A guided attempt reaches the correct result after a level-3 formula hint, preserving assistance provenance.",
  attempt: {
    schemaVersion: V2_CONTRACT_VERSION,
    attemptId: "attempt-guided-formula-hint",
    problemDefinitionId: kpGoldProblemV2.id,
    problemDefinitionVersion: kpGoldProblemV2.version,
    learnerMode: "GUIDE_ME",
    modality: "MIXED",
    artifacts: [
      {
        id: "guided-structured",
        modality: "STRUCTURED",
        mediaType: "application/vnd.standard-trainer.guided+json",
        contentRef: "gold://kp/guided-formula-hint/structured",
      },
      {
        id: "guided-ink",
        modality: "DIGITAL_INK",
        mediaType: "application/vnd.standard-trainer.ink+json",
        contentRef: "gold://kp/guided-formula-hint/ink",
      },
    ],
    factsUsed: requiredFacts("guided-working"),
    target: { quantity: "KP", evidenceStepIds: ["guided-working"], explicit: true },
    steps: [
      {
        id: "guided-working",
        source: source(
          "guided-ink",
          "DIGITAL_INK",
          "p(N2O4)=200, p(NO2)=300; Kp=300^2/200=450 kPa",
        ),
        rawTranscription: "p(N₂O₄)=200, p(NO₂)=300; Kp=300²/200=450 kPa",
        semanticType: "FINAL_ANSWER",
        concept: "KP_RESULT",
        expressionAst: correctFormulaAst,
        declaredResult: 450,
        unit: "kPa",
        significantFigures: 3,
        recognitionConfidence: 1,
        recognitionStatus: "CONFIRMED",
        ambiguities: [],
        studentConfirmed: true,
      },
    ],
    finalAnswer: { value: 450, unit: "kPa", significantFigures: 3 },
    recognitionIssues: [],
    assistanceEvents: [
      {
        stage: "FORMULA",
        level: 3,
        hintId: "FORMULA-KP-01",
        trigger: "LEARNER_REQUEST",
        revealedConcepts: ["Kp = p(NO₂)² / p(N₂O₄)"],
        timestamp: "2026-07-14T07:59:00.000Z",
      },
    ],
  },
  expected: {
    decision: "SOLVED",
    failureCode: null,
    firstPedagogicalError: null,
    masteryOutcome: "SOLVED_AFTER_FORMULA_HINT",
    stageEvaluations: [
      stage("DATA_EXTRACTION", "NOT_OBSERVED", null, ["guided-working"]),
      stage("TARGET_IDENTIFICATION", "CORRECT", null, ["guided-working"]),
      stage("STRATEGY", "CORRECT", null, ["guided-working"]),
      stage("FORMULA", "SUPPORTED_BY_HINT", null, ["guided-working"]),
      stage("SUBSTITUTION", "CORRECT", null, ["guided-working"]),
      stage("ARITHMETIC", "CORRECT", null, ["guided-working"]),
      stage("UNIT", "CORRECT", null, ["guided-working"]),
      stage("PRECISION", "CORRECT", null, ["guided-working"]),
    ],
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
] as const satisfies readonly NormalizedAttemptFixture[]);

export const kpGoldFixtureMetadata = Object.freeze({
  problemId: kpGoldProblemV2.id,
  problemVersion: kpGoldProblemV2.version,
  contractVersion: V2_CONTRACT_VERSION,
  authoredAt: submittedAt,
  fixtureCount: kpNormalizedAttemptFixtures.length,
});
