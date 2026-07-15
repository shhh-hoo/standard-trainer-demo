import { V2_CONTRACT_VERSION } from "../../domain/v2/types";
import type {
  DiagnosticProblemDefinitionV2,
  ExpressionAst,
  ReasoningEvidenceKind,
  StrategyNodeRequirement,
  VariableReference,
} from "../../domain/v2/types";

function evidence<const T extends readonly ReasoningEvidenceKind[]>(...values: T): T {
  return Object.freeze(values) as T;
}

function quantity(symbol: string, reasoningNodeId: string): VariableReference {
  return { source: "REASONING_QUANTITY", symbol, reasoningNodeId };
}

function variable(reference: VariableReference): ExpressionAst {
  return { kind: "VARIABLE", reference };
}

function required(
  nodeId: string,
  ...allowedEvidenceKinds: readonly ReasoningEvidenceKind[]
): StrategyNodeRequirement {
  return {
    nodeId,
    requirement: "REQUIRED",
    allowedEvidenceKinds,
  };
}

export const kpFormulaAst = Object.freeze({
  kind: "BINARY",
  operator: "DIVIDE",
  left: {
    kind: "BINARY",
    operator: "POWER",
    left: variable(quantity("p_NO2", "partial-pressure-no2")),
    right: { kind: "NUMBER", value: 2, raw: "2" },
  },
  right: variable(quantity("p_N2O4", "partial-pressure-n2o4")),
} as const satisfies ExpressionAst);

export const kpGoldProblemV2 = Object.freeze({
  schemaVersion: V2_CONTRACT_VERSION,
  id: "KP_FROM_EQUILIBRIUM_MOLES_V2_GOLD",
  version: "2.0.0-gold.2",
  title: "Kp from equilibrium amounts and total pressure",
  reaction: "N₂O₄(g) ⇌ 2NO₂(g)",
  prompt:
    "At equilibrium, a 2.00 dm³ vessel contains 0.400 mol N₂O₄ and 0.600 mol NO₂. The total pressure is 500 kPa. Calculate Kp for N₂O₄(g) ⇌ 2NO₂(g). Give your answer to 3 significant figures.",
  authoredFacts: Object.freeze([
    Object.freeze({
      id: "equilibrium-moles-n2o4",
      label: "Equilibrium amount of N₂O₄",
      value: 0.4,
      unit: "mol",
      relevance: "REQUIRED",
    }),
    Object.freeze({
      id: "equilibrium-moles-no2",
      label: "Equilibrium amount of NO₂",
      value: 0.6,
      unit: "mol",
      relevance: "REQUIRED",
    }),
    Object.freeze({
      id: "total-pressure",
      label: "Total equilibrium pressure",
      value: 500,
      unit: "kPa",
      relevance: "REQUIRED",
    }),
    Object.freeze({
      id: "vessel-volume",
      label: "Vessel volume",
      value: 2,
      unit: "dm³",
      relevance: "IRRELEVANT",
    }),
    Object.freeze({
      id: "required-precision",
      label: "Required precision",
      value: 3,
      unit: "significant figures",
      relevance: "REQUIRED",
    }),
  ]),
  target: Object.freeze({
    quantity: "KP",
    acceptedUnits: Object.freeze(["kPa"]),
    significantFigures: 3,
  }),
  formulaDefinitions: Object.freeze([
    Object.freeze({
      id: "formula-kp-no2-n2o4",
      targetReasoningNodeId: "construct-kp-expression",
      expression: kpFormulaAst,
    }),
  ]),
  reasoningGraph: Object.freeze({
    version: "kp-reasoning-graph-v2.0.0-gold.2",
    pedagogicalOrder: Object.freeze([
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
    ]),
    nodes: Object.freeze({
      "select-relevant-data": Object.freeze({
        id: "select-relevant-data",
        category: "DATA_EXTRACTION",
        concept: null,
        dependencies: Object.freeze([]),
        solutionEvidenceKinds: evidence("FACT_USE", "EXPLICIT_STEP"),
        independentStageEvidenceKinds: evidence("EXPLICIT_STEP"),
      }),
      "identify-kp-target": Object.freeze({
        id: "identify-kp-target",
        category: "TARGET_IDENTIFICATION",
        concept: "KP_RESULT",
        dependencies: Object.freeze([]),
        solutionEvidenceKinds: evidence(
          "TARGET_STATEMENT",
          "FORMULA_AST",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence("TARGET_STATEMENT", "FORMULA_AST"),
      }),
      "choose-partial-pressure-strategy": Object.freeze({
        id: "choose-partial-pressure-strategy",
        category: "STRATEGY",
        concept: "PARTIAL_PRESSURE",
        dependencies: Object.freeze(["select-relevant-data", "identify-kp-target"]),
        solutionEvidenceKinds: evidence(
          "EXPLICIT_STEP",
          "EQUATION",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence(
          "EXPLICIT_STEP",
          "EQUATION",
          "EMBEDDED_CALCULATION",
        ),
      }),
      "total-moles": Object.freeze({
        id: "total-moles",
        category: "STRATEGY",
        concept: "TOTAL_MOLES",
        dependencies: Object.freeze(["select-relevant-data"]),
        solutionEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence("EQUATION", "DECLARED_RESULT"),
      }),
      "mole-fraction-n2o4": Object.freeze({
        id: "mole-fraction-n2o4",
        category: "STRATEGY",
        concept: "MOLE_FRACTION",
        dependencies: Object.freeze(["total-moles"]),
        solutionEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence("EQUATION", "DECLARED_RESULT"),
      }),
      "mole-fraction-no2": Object.freeze({
        id: "mole-fraction-no2",
        category: "STRATEGY",
        concept: "MOLE_FRACTION",
        dependencies: Object.freeze(["total-moles"]),
        solutionEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence("EQUATION", "DECLARED_RESULT"),
      }),
      "partial-pressure-n2o4": Object.freeze({
        id: "partial-pressure-n2o4",
        category: "STRATEGY",
        concept: "PARTIAL_PRESSURE",
        dependencies: Object.freeze(["mole-fraction-n2o4"]),
        solutionEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence("EQUATION", "DECLARED_RESULT"),
      }),
      "partial-pressure-no2": Object.freeze({
        id: "partial-pressure-no2",
        category: "STRATEGY",
        concept: "PARTIAL_PRESSURE",
        dependencies: Object.freeze(["mole-fraction-no2"]),
        solutionEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence("EQUATION", "DECLARED_RESULT"),
      }),
      "construct-kp-expression": Object.freeze({
        id: "construct-kp-expression",
        category: "FORMULA",
        concept: "KP_EXPRESSION",
        dependencies: Object.freeze(["identify-kp-target"]),
        solutionEvidenceKinds: evidence("FORMULA_AST", "EMBEDDED_CALCULATION"),
        independentStageEvidenceKinds: evidence("FORMULA_AST", "EMBEDDED_CALCULATION"),
      }),
      "substitute-values": Object.freeze({
        id: "substitute-values",
        category: "SUBSTITUTION",
        concept: "KP_EXPRESSION",
        dependencies: Object.freeze([
          "choose-partial-pressure-strategy",
          "construct-kp-expression",
        ]),
        solutionEvidenceKinds: evidence("EQUATION", "EMBEDDED_CALCULATION"),
        independentStageEvidenceKinds: evidence("EQUATION", "EMBEDDED_CALCULATION"),
      }),
      "calculate-result": Object.freeze({
        id: "calculate-result",
        category: "ARITHMETIC",
        concept: "KP_RESULT",
        dependencies: Object.freeze(["substitute-values"]),
        solutionEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
        independentStageEvidenceKinds: evidence(
          "EQUATION",
          "DECLARED_RESULT",
          "EMBEDDED_CALCULATION",
        ),
      }),
      "report-unit": Object.freeze({
        id: "report-unit",
        category: "UNIT",
        concept: "KP_RESULT",
        dependencies: Object.freeze(["calculate-result"]),
        solutionEvidenceKinds: evidence("DECLARED_RESULT"),
        independentStageEvidenceKinds: evidence("DECLARED_RESULT"),
      }),
      "report-precision": Object.freeze({
        id: "report-precision",
        category: "PRECISION",
        concept: "KP_RESULT",
        dependencies: Object.freeze(["calculate-result"]),
        solutionEvidenceKinds: evidence("DECLARED_RESULT"),
        independentStageEvidenceKinds: evidence("DECLARED_RESULT"),
      }),
    }),
    acceptedStrategies: Object.freeze([
      Object.freeze({
        id: "EXPLICIT_PARTIAL_PRESSURES",
        label: "Show total moles, mole fractions, and both partial-pressure equations",
        nodeRequirements: Object.freeze([
          required("select-relevant-data", "FACT_USE", "EXPLICIT_STEP"),
          required("identify-kp-target", "TARGET_STATEMENT", "FORMULA_AST"),
          required("choose-partial-pressure-strategy", "EXPLICIT_STEP", "EQUATION"),
          required("total-moles", "EQUATION", "DECLARED_RESULT"),
          required("mole-fraction-n2o4", "EQUATION", "DECLARED_RESULT"),
          required("mole-fraction-no2", "EQUATION", "DECLARED_RESULT"),
          required("partial-pressure-n2o4", "EQUATION", "DECLARED_RESULT"),
          required("partial-pressure-no2", "EQUATION", "DECLARED_RESULT"),
          required("construct-kp-expression", "FORMULA_AST"),
          required("substitute-values", "EQUATION"),
          required("calculate-result", "EQUATION", "DECLARED_RESULT"),
          required("report-unit", "DECLARED_RESULT"),
          required("report-precision", "DECLARED_RESULT"),
        ]),
      }),
      Object.freeze({
        id: "COMPRESSED_DIRECT_SUBSTITUTION",
        label: "Embed every partial-pressure dependency in one complete calculation AST",
        nodeRequirements: Object.freeze([
          required("select-relevant-data", "FACT_USE"),
          required("identify-kp-target", "EMBEDDED_CALCULATION", "FORMULA_AST"),
          required("choose-partial-pressure-strategy", "EMBEDDED_CALCULATION"),
          required("total-moles", "EMBEDDED_CALCULATION"),
          required("mole-fraction-n2o4", "EMBEDDED_CALCULATION"),
          required("mole-fraction-no2", "EMBEDDED_CALCULATION"),
          required("partial-pressure-n2o4", "EMBEDDED_CALCULATION"),
          required("partial-pressure-no2", "EMBEDDED_CALCULATION"),
          required("construct-kp-expression", "EMBEDDED_CALCULATION"),
          required("substitute-values", "EMBEDDED_CALCULATION"),
          required("calculate-result", "EMBEDDED_CALCULATION"),
          required("report-unit", "DECLARED_RESULT"),
          required("report-precision", "DECLARED_RESULT"),
        ]),
      }),
    ]),
  }),
  recognitionPolicy: Object.freeze({
    version: "recognition-policy-v2.0.0-gold.2",
    autoAcceptThreshold: 0.95,
    localConfirmationThreshold: 0.7,
    belowConfirmationThreshold: "ABSTAIN",
  }),
  diagnosisPolicyVersion: "diagnosis-policy-v2.0.0-gold.2",
  hintPolicy: Object.freeze({
    version: "hint-policy-v2.0.0-gold.2",
    automaticEscalationAfterConsecutiveFailures: 2,
    hints: Object.freeze([
      Object.freeze({
        id: "META-TARGET-01",
        stage: "TARGET_IDENTIFICATION",
        level: 1,
        revealedReasoningNodeIds: Object.freeze([]),
        revealedContentIds: Object.freeze(["prompt-restate-target"]),
      }),
      Object.freeze({
        id: "STRATEGY-PARTIAL-PRESSURE-01",
        stage: "STRATEGY",
        level: 2,
        revealedReasoningNodeIds: Object.freeze(["choose-partial-pressure-strategy"]),
        revealedContentIds: Object.freeze(["strategy-partial-pressure-from-mole-fraction"]),
      }),
      Object.freeze({
        id: "FORMULA-KP-01",
        stage: "FORMULA",
        level: 3,
        revealedReasoningNodeIds: Object.freeze(["construct-kp-expression"]),
        revealedContentIds: Object.freeze(["formula-kp-no2-n2o4"]),
      }),
      Object.freeze({
        id: "FULL-SCAFFOLD-KP-01",
        stage: "SUBSTITUTION",
        level: 4,
        revealedReasoningNodeIds: Object.freeze([
          "total-moles",
          "mole-fraction-n2o4",
          "mole-fraction-no2",
          "partial-pressure-n2o4",
          "partial-pressure-no2",
          "construct-kp-expression",
          "substitute-values",
        ]),
        revealedContentIds: Object.freeze(["scaffold-v0.1-seven-step-kp"]),
      }),
    ]),
  }),
} as const satisfies DiagnosticProblemDefinitionV2);
