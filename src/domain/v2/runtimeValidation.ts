import { collectVariableReferences } from "./expressionEvaluator";
import { aggregateRecognitionGate } from "./recognitionGate";
import {
  V2_CONTRACT_VERSION,
  type DiagnosticEvidenceTraceV2,
  type DiagnosticProblemDefinitionV2,
  type ExpressionAst,
  type NormalizedAttempt,
  type RecognitionEvidence,
} from "./types";

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

type UnknownRecord = Record<string, unknown>;

const modalities = new Set([
  "HANDWRITING_IMAGE",
  "DIGITAL_INK",
  "TYPED_WORKING",
  "EXPLANATION",
  "STRUCTURED",
]);
const categories = [
  "DATA_EXTRACTION",
  "TARGET_IDENTIFICATION",
  "STRATEGY",
  "FORMULA",
  "SUBSTITUTION",
  "ARITHMETIC",
  "UNIT",
  "PRECISION",
] as const;
const semanticTypes = new Set([
  "DATA_SELECTION",
  "TARGET_IDENTIFICATION",
  "STRATEGY",
  "FORMULA",
  "SUBSTITUTION",
  "ARITHMETIC",
  "UNIT",
  "FINAL_ANSWER",
  "UNKNOWN",
]);
const concepts = new Set([
  "TOTAL_MOLES",
  "MOLE_FRACTION",
  "PARTIAL_PRESSURE",
  "KP_EXPRESSION",
  "KP_RESULT",
]);
const reasoningEvidenceKinds = new Set([
  "EXPLICIT_STEP",
  "FORMULA_AST",
  "EQUATION",
  "DECLARED_RESULT",
  "FACT_USE",
  "TARGET_STATEMENT",
  "EMBEDDED_CALCULATION",
  "INFERRED",
]);
const evaluationStatuses = new Set([
  "CORRECT",
  "INCORRECT",
  "AMBIGUOUS_RECOGNITION",
  "NOT_OBSERVED",
  "DOWNSTREAM_AFFECTED",
  "NOT_EVALUATED",
  "SUPPORTED_BY_HINT",
]);
const diagnosisDecisions = new Set([
  "SOLVED",
  "STUDENT_ERROR",
  "INCOMPLETE_EVIDENCE",
  "RECOGNITION_UNCERTAIN",
  "NOT_SOLVED",
]);
const supportOutcomes = new Set([
  "SOLVED_INDEPENDENTLY",
  "SOLVED_AFTER_METACOGNITIVE_PROMPT",
  "SOLVED_AFTER_STRATEGY_HINT",
  "SOLVED_AFTER_FORMULA_HINT",
  "SOLVED_USING_FULL_SCAFFOLD",
  "NOT_SOLVED_AFTER_FULL_SCAFFOLD",
  "INSUFFICIENT_EVIDENCE",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: ValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function requireRecord(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): UnknownRecord | null {
  if (!isRecord(value)) {
    issue(issues, path, "EXPECTED_OBJECT", "Expected an object.");
    return null;
  }
  return value;
}

function requireArray(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): readonly unknown[] {
  if (!Array.isArray(value)) {
    issue(issues, path, "EXPECTED_ARRAY", "Expected an array.");
    return [];
  }
  return value;
}

function requireString(value: unknown, path: string, issues: ValidationIssue[]): string | null {
  if (typeof value !== "string" || value.length === 0) {
    issue(issues, path, "EXPECTED_NON_EMPTY_STRING", "Expected a non-empty string.");
    return null;
  }
  return value;
}

function requireFinite(value: unknown, path: string, issues: ValidationIssue[]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issue(issues, path, "EXPECTED_FINITE_NUMBER", "Expected a finite number.");
    return null;
  }
  return value;
}

function requireBoolean(value: unknown, path: string, issues: ValidationIssue[]): boolean | null {
  if (typeof value !== "boolean") {
    issue(issues, path, "EXPECTED_BOOLEAN", "Expected a boolean.");
    return null;
  }
  return value;
}

function requirePositiveInteger(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  code = "INVALID_SEQUENCE",
): number | null {
  const number = requireFinite(value, path, issues);
  if (number !== null && (!Number.isInteger(number) || number < 1)) {
    issue(issues, path, code, "Expected a positive integer.");
  }
  return number;
}

function requireIsoTimestamp(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): string | null {
  const timestamp = requireString(value, path, issues);
  if (
    timestamp !== null &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp)))
  ) {
    issue(issues, path, "INVALID_TIMESTAMP", "Expected a valid ISO-8601 UTC timestamp.");
  }
  return timestamp;
}

function validateQuantityValue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  const quantity = requireRecord(value, path, issues);
  if (!quantity) return;
  requireFinite(quantity.value, `${path}.value`, issues);
  if (quantity.unit !== undefined) requireString(quantity.unit, `${path}.unit`, issues);
  if (quantity.raw !== undefined) requireString(quantity.raw, `${path}.raw`, issues);
  if (quantity.significantFigures !== undefined) {
    requirePositiveInteger(
      quantity.significantFigures,
      `${path}.significantFigures`,
      issues,
      "INVALID_SIGNIFICANT_FIGURES",
    );
  }
}

function requireUnique(
  values: readonly (string | number | null)[],
  path: string,
  issues: ValidationIssue[],
): void {
  const usable = values.filter((value): value is string | number => value !== null);
  if (new Set(usable).size !== usable.length) {
    issue(issues, path, "DUPLICATE_ID_OR_SEQUENCE", "Values must be unique.");
  }
}

function validateProbability(value: unknown, path: string, issues: ValidationIssue[]): void {
  const number = requireFinite(value, path, issues);
  if (number !== null && (number < 0 || number > 1)) {
    issue(issues, path, "OUT_OF_RANGE", "Confidence must be between 0 and 1.");
  }
}

function validateExpressionShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is ExpressionAst {
  const expression = requireRecord(value, path, issues);
  if (!expression) return false;
  if (expression.kind === "NUMBER") {
    requireFinite(expression.value, `${path}.value`, issues);
    requireString(expression.raw, `${path}.raw`, issues);
    return true;
  }
  if (expression.kind === "VARIABLE") {
    const reference = requireRecord(expression.reference, `${path}.reference`, issues);
    if (!reference) return true;
    requireString(reference.symbol, `${path}.reference.symbol`, issues);
    if (reference.source === "AUTHORED_FACT") {
      requireString(reference.factId, `${path}.reference.factId`, issues);
    } else if (reference.source === "NORMALIZED_STEP_RESULT") {
      requireString(reference.stepId, `${path}.reference.stepId`, issues);
    } else if (reference.source === "REASONING_QUANTITY") {
      requireString(reference.reasoningNodeId, `${path}.reference.reasoningNodeId`, issues);
    } else {
      issue(issues, `${path}.reference.source`, "INVALID_UNION", "Unknown variable source.");
    }
    return true;
  }
  if (expression.kind === "BINARY") {
    if (!["ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "POWER"].includes(String(expression.operator))) {
      issue(issues, `${path}.operator`, "INVALID_OPERATOR", "Unknown binary operator.");
    }
    validateExpressionShape(expression.left, `${path}.left`, issues);
    validateExpressionShape(expression.right, `${path}.right`, issues);
    return true;
  }
  if (expression.kind === "FUNCTION") {
    if (expression.name !== "SUM") {
      issue(issues, `${path}.name`, "INVALID_FUNCTION", "Only SUM is supported.");
    }
    requireArray(expression.arguments, `${path}.arguments`, issues).forEach((argument, index) =>
      validateExpressionShape(argument, `${path}.arguments[${index}]`, issues),
    );
    return true;
  }
  issue(issues, `${path}.kind`, "INVALID_EXPRESSION_KIND", "Unknown expression kind.");
  return false;
}

function validateRecognition(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  autoAcceptThreshold: number,
  localConfirmationThreshold: number,
): void {
  const recognition = requireRecord(value, path, issues);
  if (!recognition) return;
  validateProbability(recognition.confidence, `${path}.confidence`, issues);
  const status = recognition.status;
  if (status === "AUTO_ACCEPTED") {
    if (
      typeof recognition.confidence === "number" &&
      recognition.confidence < autoAcceptThreshold
    ) {
      issue(
        issues,
        `${path}.confidence`,
        "AUTO_ACCEPT_BELOW_THRESHOLD",
        "Auto-accepted recognition must meet the authored threshold.",
      );
    }
    return;
  }
  if (status === "ABSTAINED") {
    if (
      typeof recognition.confidence === "number" &&
      recognition.confidence >= localConfirmationThreshold
    ) {
      issue(
        issues,
        `${path}.confidence`,
        "ABSTENTION_ABOVE_THRESHOLD",
        "Abstained recognition must be below the local confirmation threshold.",
      );
    }
    requireString(recognition.reason, `${path}.reason`, issues);
    return;
  }
  if (status !== "STUDENT_CONFIRMED" && status !== "REQUIRES_CONFIRMATION") {
    issue(issues, `${path}.status`, "INVALID_RECOGNITION_STATUS", "Unknown recognition state.");
    return;
  }
  if (
    status === "REQUIRES_CONFIRMATION" &&
    typeof recognition.confidence === "number" &&
    (recognition.confidence < localConfirmationThreshold ||
      recognition.confidence >= autoAcceptThreshold)
  ) {
    issue(
      issues,
      `${path}.confidence`,
      "RECOGNITION_OUTSIDE_CONFIRMATION_INTERVAL",
      "Confirmation-required confidence must be within the authored confirmation interval.",
    );
  }
  const candidates = requireArray(recognition.candidates, `${path}.candidates`, issues);
  if (candidates.length === 0) {
    issue(issues, `${path}.candidates`, "EMPTY_CANDIDATES", "Candidates are required.");
  }
  const transcriptions: string[] = [];
  candidates.forEach((candidate, index) => {
    const record = requireRecord(candidate, `${path}.candidates[${index}]`, issues);
    if (!record) return;
    const transcription = requireString(
      record.transcription,
      `${path}.candidates[${index}].transcription`,
      issues,
    );
    if (transcription) transcriptions.push(transcription);
    validateProbability(record.confidence, `${path}.candidates[${index}].confidence`, issues);
  });
  if (status === "STUDENT_CONFIRMED") {
    const selected = requireString(
      recognition.selectedTranscription,
      `${path}.selectedTranscription`,
      issues,
    );
    if (selected && !transcriptions.includes(selected)) {
      issue(
        issues,
        `${path}.selectedTranscription`,
        "UNRESOLVED_CONFIRMATION",
        "The selected transcription must be one of the candidates.",
      );
    }
  }
}

export function validateDiagnosticProblemDefinitionV2(
  value: unknown,
): ValidationResult<DiagnosticProblemDefinitionV2> {
  const issues: ValidationIssue[] = [];
  const problem = requireRecord(value, "$", issues);
  if (!problem) return { ok: false, issues };
  if (problem.schemaVersion !== V2_CONTRACT_VERSION) {
    issue(issues, "$.schemaVersion", "WRONG_CONTRACT_VERSION", `Expected ${V2_CONTRACT_VERSION}.`);
  }
  requireString(problem.id, "$.id", issues);
  requireString(problem.version, "$.version", issues);
  requireString(problem.title, "$.title", issues);
  requireString(problem.prompt, "$.prompt", issues);
  requireString(problem.reaction, "$.reaction", issues);

  const facts = requireArray(problem.authoredFacts, "$.authoredFacts", issues);
  const factIds = facts.map((fact, index) => {
    const record = requireRecord(fact, `$.authoredFacts[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.authoredFacts[${index}].id`, issues);
    requireString(record.label, `$.authoredFacts[${index}].label`, issues);
    if (typeof record.value !== "string") requireFinite(record.value, `$.authoredFacts[${index}].value`, issues);
    if (record.unit !== undefined) requireString(record.unit, `$.authoredFacts[${index}].unit`, issues);
    if (record.relevance !== "REQUIRED" && record.relevance !== "IRRELEVANT") {
      issue(issues, `$.authoredFacts[${index}].relevance`, "INVALID_RELEVANCE", "Unknown relevance.");
    }
    return id;
  });
  requireUnique(factIds, "$.authoredFacts", issues);

  const target = requireRecord(problem.target, "$.target", issues);
  if (target) {
    if (target.quantity !== "KP") issue(issues, "$.target.quantity", "UNSUPPORTED_TARGET", "Only KP is supported.");
    const units = requireArray(target.acceptedUnits, "$.target.acceptedUnits", issues);
    units.forEach((unit, index) => requireString(unit, `$.target.acceptedUnits[${index}]`, issues));
    requirePositiveInteger(
      target.significantFigures,
      "$.target.significantFigures",
      issues,
      "INVALID_SIGNIFICANT_FIGURES",
    );
  }

  const graph = requireRecord(problem.reasoningGraph, "$.reasoningGraph", issues);
  const nodeIds = new Set<string>();
  let nodes: UnknownRecord = {};
  let order: readonly unknown[] = [];
  if (graph) {
    requireString(graph.version, "$.reasoningGraph.version", issues);
    nodes = requireRecord(graph.nodes, "$.reasoningGraph.nodes", issues) ?? {};
    order = requireArray(graph.pedagogicalOrder, "$.reasoningGraph.pedagogicalOrder", issues);
    order.forEach((id, index) => {
      const valid = requireString(id, `$.reasoningGraph.pedagogicalOrder[${index}]`, issues);
      if (valid) nodeIds.add(valid);
    });
    requireUnique(order.map((id) => (typeof id === "string" ? id : null)), "$.reasoningGraph.pedagogicalOrder", issues);
    if (new Set(Object.keys(nodes)).size !== nodeIds.size || Object.keys(nodes).some((id) => !nodeIds.has(id))) {
      issue(issues, "$.reasoningGraph.nodes", "GRAPH_NODE_SET_MISMATCH", "Node keys must equal pedagogical order.");
    }
    Object.entries(nodes).forEach(([key, value]) => {
      const node = requireRecord(value, `$.reasoningGraph.nodes.${key}`, issues);
      if (!node) return;
      const nodePosition = order.indexOf(key);
      if (node.id !== key) issue(issues, `$.reasoningGraph.nodes.${key}.id`, "NODE_ID_MISMATCH", "Node id must match its key.");
      if (!categories.includes(node.category as (typeof categories)[number])) {
        issue(issues, `$.reasoningGraph.nodes.${key}.category`, "INVALID_CATEGORY", "Unknown diagnosis category.");
      }
      if (node.concept !== null && !concepts.has(String(node.concept))) {
        issue(issues, `$.reasoningGraph.nodes.${key}.concept`, "INVALID_CONCEPT", "Unknown chemistry concept.");
      }
      requireArray(node.dependencies, `$.reasoningGraph.nodes.${key}.dependencies`, issues).forEach((dependency, dependencyIndex) => {
        if (typeof dependency !== "string" || !nodeIds.has(dependency)) {
          issue(issues, `$.reasoningGraph.nodes.${key}.dependencies[${dependencyIndex}]`, "UNRESOLVED_REASONING_NODE", "Unknown reasoning dependency.");
        } else if (order.indexOf(dependency) >= nodePosition) {
          issue(issues, `$.reasoningGraph.nodes.${key}.dependencies[${dependencyIndex}]`, "FORWARD_REASONING_REFERENCE", "Dependencies must be earlier in pedagogical order.");
        }
      });
      const solutionKinds = requireArray(node.solutionEvidenceKinds, `$.reasoningGraph.nodes.${key}.solutionEvidenceKinds`, issues);
      solutionKinds.forEach((kind, kindIndex) => {
        if (!reasoningEvidenceKinds.has(String(kind))) {
          issue(
            issues,
            `$.reasoningGraph.nodes.${key}.solutionEvidenceKinds[${kindIndex}]`,
            "INVALID_EVIDENCE_KIND",
            "Unknown reasoning evidence kind.",
          );
        }
      });
      const independent = requireArray(node.independentStageEvidenceKinds, `$.reasoningGraph.nodes.${key}.independentStageEvidenceKinds`, issues);
      independent.forEach((kind, kindIndex) => {
        if (!reasoningEvidenceKinds.has(String(kind))) {
          issue(
            issues,
            `$.reasoningGraph.nodes.${key}.independentStageEvidenceKinds[${kindIndex}]`,
            "INVALID_EVIDENCE_KIND",
            "Unknown independent evidence kind.",
          );
        }
      });
      if (independent.includes("INFERRED")) {
        issue(issues, `$.reasoningGraph.nodes.${key}.independentStageEvidenceKinds`, "INFERRED_NOT_INDEPENDENT", "Inferred evidence cannot independently prove a stage.");
      }
    });

    const strategies = requireArray(graph.acceptedStrategies, "$.reasoningGraph.acceptedStrategies", issues);
    const strategyIds = strategies.map((strategy, index) => {
      const record = requireRecord(strategy, `$.reasoningGraph.acceptedStrategies[${index}]`, issues);
      if (!record) return null;
      const id = requireString(record.id, `$.reasoningGraph.acceptedStrategies[${index}].id`, issues);
      requireArray(record.nodeRequirements, `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements`, issues).forEach((requirement, requirementIndex) => {
        const req = requireRecord(requirement, `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements[${requirementIndex}]`, issues);
        if (!req) return;
        if (typeof req.nodeId !== "string" || !nodeIds.has(req.nodeId)) {
          issue(issues, `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements[${requirementIndex}].nodeId`, "UNRESOLVED_REASONING_NODE", "Unknown strategy node.");
        }
        const allowedKinds = requireArray(
          req.allowedEvidenceKinds,
          `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements[${requirementIndex}].allowedEvidenceKinds`,
          issues,
        );
        allowedKinds.forEach((kind, kindIndex) => {
          if (!reasoningEvidenceKinds.has(String(kind))) {
            issue(
              issues,
              `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements[${requirementIndex}].allowedEvidenceKinds[${kindIndex}]`,
              "INVALID_EVIDENCE_KIND",
              "Unknown strategy evidence kind.",
            );
          }
        });
        const node = typeof req.nodeId === "string" ? nodes[req.nodeId] : undefined;
        const solutionEvidenceKinds = isRecord(node)
          ? node.solutionEvidenceKinds
          : undefined;
        if (
          Array.isArray(solutionEvidenceKinds) &&
          allowedKinds.some((kind) => !solutionEvidenceKinds.includes(kind))
        ) {
          issue(
            issues,
            `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements[${requirementIndex}].allowedEvidenceKinds`,
            "UNSUPPORTED_STRATEGY_EVIDENCE",
            "Strategy evidence must be allowed by its reasoning node.",
          );
        }
        if (req.requirement !== "REQUIRED" && req.requirement !== "OPTIONAL") {
          issue(issues, `$.reasoningGraph.acceptedStrategies[${index}].nodeRequirements[${requirementIndex}].requirement`, "INVALID_REQUIREMENT", "Unknown requirement.");
        }
      });
      return id;
    });
    requireUnique(strategyIds, "$.reasoningGraph.acceptedStrategies", issues);
  }

  const formulas = requireArray(problem.formulaDefinitions, "$.formulaDefinitions", issues);
  const formulaIds = formulas.map((formula, index) => {
    const record = requireRecord(formula, `$.formulaDefinitions[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.formulaDefinitions[${index}].id`, issues);
    if (typeof record.targetReasoningNodeId !== "string" || !nodeIds.has(record.targetReasoningNodeId)) {
      issue(issues, `$.formulaDefinitions[${index}].targetReasoningNodeId`, "UNRESOLVED_REASONING_NODE", "Unknown formula target node.");
    }
    if (validateExpressionShape(record.expression, `$.formulaDefinitions[${index}].expression`, issues)) {
      for (const reference of collectVariableReferences(record.expression)) {
        if (reference.source === "NORMALIZED_STEP_RESULT") {
          issue(
            issues,
            `$.formulaDefinitions[${index}].expression`,
            "FORBIDDEN_FORMULA_STEP_REFERENCE",
            "Authored formula definitions cannot reference normalized attempt steps.",
          );
        }
        if (reference.source === "AUTHORED_FACT" && !factIds.includes(reference.factId)) {
          issue(issues, `$.formulaDefinitions[${index}].expression`, "UNRESOLVED_FACT", `Unknown fact ${reference.factId}.`);
        }
        if (reference.source === "REASONING_QUANTITY" && !nodeIds.has(reference.reasoningNodeId)) {
          issue(issues, `$.formulaDefinitions[${index}].expression`, "UNRESOLVED_REASONING_NODE", `Unknown node ${reference.reasoningNodeId}.`);
        }
      }
    }
    return id;
  });
  requireUnique(formulaIds, "$.formulaDefinitions", issues);

  const recognition = requireRecord(problem.recognitionPolicy, "$.recognitionPolicy", issues);
  if (recognition) {
    requireString(recognition.version, "$.recognitionPolicy.version", issues);
    validateProbability(recognition.autoAcceptThreshold, "$.recognitionPolicy.autoAcceptThreshold", issues);
    validateProbability(recognition.localConfirmationThreshold, "$.recognitionPolicy.localConfirmationThreshold", issues);
    if (
      typeof recognition.autoAcceptThreshold === "number" &&
      typeof recognition.localConfirmationThreshold === "number" &&
      recognition.autoAcceptThreshold < recognition.localConfirmationThreshold
    ) {
      issue(issues, "$.recognitionPolicy", "INVALID_THRESHOLDS", "Auto-accept threshold must be at least the confirmation threshold.");
    }
    if (recognition.belowConfirmationThreshold !== "ABSTAIN") {
      issue(issues, "$.recognitionPolicy.belowConfirmationThreshold", "INVALID_ABSTENTION_POLICY", "Below-threshold evidence must abstain.");
    }
  }
  requireString(problem.diagnosisPolicyVersion, "$.diagnosisPolicyVersion", issues);
  const hintPolicy = requireRecord(problem.hintPolicy, "$.hintPolicy", issues);
  if (hintPolicy) {
    requireString(hintPolicy.version, "$.hintPolicy.version", issues);
    requirePositiveInteger(
      hintPolicy.automaticEscalationAfterConsecutiveFailures,
      "$.hintPolicy.automaticEscalationAfterConsecutiveFailures",
      issues,
      "INVALID_ESCALATION_THRESHOLD",
    );
    const hints = requireArray(hintPolicy.hints, "$.hintPolicy.hints", issues);
    const hintIds = hints.map((hint, index) => {
      const record = requireRecord(hint, `$.hintPolicy.hints[${index}]`, issues);
      if (!record) return null;
      const id = requireString(record.id, `$.hintPolicy.hints[${index}].id`, issues);
      if (!categories.includes(record.stage as (typeof categories)[number])) {
        issue(issues, `$.hintPolicy.hints[${index}].stage`, "INVALID_CATEGORY", "Unknown hint stage.");
      }
      if (![1, 2, 3, 4].includes(record.level as number)) {
        issue(issues, `$.hintPolicy.hints[${index}].level`, "INVALID_LEVEL", "Hint level must be 1..4.");
      }
      requireArray(record.revealedReasoningNodeIds, `$.hintPolicy.hints[${index}].revealedReasoningNodeIds`, issues).forEach((nodeId, nodeIndex) => {
        if (typeof nodeId !== "string" || !nodeIds.has(nodeId)) {
          issue(issues, `$.hintPolicy.hints[${index}].revealedReasoningNodeIds[${nodeIndex}]`, "UNRESOLVED_REASONING_NODE", "Unknown revealed node.");
        }
      });
      requireArray(
        record.revealedContentIds,
        `$.hintPolicy.hints[${index}].revealedContentIds`,
        issues,
      ).forEach((contentId, contentIndex) =>
        requireString(
          contentId,
          `$.hintPolicy.hints[${index}].revealedContentIds[${contentIndex}]`,
          issues,
        ),
      );
      return id;
    });
    requireUnique(hintIds, "$.hintPolicy.hints", issues);
  }
  return issues.length === 0
    ? { ok: true, value: value as DiagnosticProblemDefinitionV2 }
    : { ok: false, issues };
}

function validateSource(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  artifacts: ReadonlyMap<string, UnknownRecord>,
): void {
  const source = requireRecord(value, path, issues);
  if (!source) return;
  const artifactId = requireString(source.artifactId, `${path}.artifactId`, issues);
  const artifact = artifactId ? artifacts.get(artifactId) : undefined;
  if (artifactId && !artifact) issue(issues, `${path}.artifactId`, "MISSING_ARTIFACT", "Source artifact does not exist.");
  if (!modalities.has(String(source.modality))) issue(issues, `${path}.modality`, "INVALID_MODALITY", "Unknown source modality.");
  if (artifact && artifact.modality !== source.modality) {
    issue(issues, `${path}.modality`, "SOURCE_MODALITY_MISMATCH", "Source modality must match its artifact.");
  }
  if (source.modality === "HANDWRITING_IMAGE" || source.modality === "DIGITAL_INK") {
    const page = requireFinite(source.page, `${path}.page`, issues);
    if (page !== null && (!Number.isInteger(page) || page < 1 || (typeof artifact?.pageCount === "number" && page > artifact.pageCount))) {
      issue(issues, `${path}.page`, "INVALID_PAGE", "Visual page is outside the artifact.");
    }
    const box = requireRecord(source.boundingBox, `${path}.boundingBox`, issues);
    if (box) {
      if (box.coordinateSpace !== "NORMALIZED_0_TO_1") {
        issue(issues, `${path}.boundingBox.coordinateSpace`, "INVALID_COORDINATE_SPACE", "Bounding boxes must be normalized.");
      }
      const x = requireFinite(box.x, `${path}.boundingBox.x`, issues);
      const y = requireFinite(box.y, `${path}.boundingBox.y`, issues);
      const width = requireFinite(box.width, `${path}.boundingBox.width`, issues);
      const height = requireFinite(box.height, `${path}.boundingBox.height`, issues);
      if (x !== null && y !== null && width !== null && height !== null && (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1)) {
        issue(issues, `${path}.boundingBox`, "INVALID_BOUNDING_BOX", "Bounding box must have positive dimensions within 0..1.");
      }
    }
  } else {
    requireString(source.textSpan, `${path}.textSpan`, issues);
  }
}

export function validateNormalizedAttempt(
  value: unknown,
  problem: DiagnosticProblemDefinitionV2,
): ValidationResult<NormalizedAttempt> {
  const issues: ValidationIssue[] = [];
  if (!validateDiagnosticProblemDefinitionV2(problem).ok) {
    return { ok: false, issues: [{ path: "$problem", code: "INVALID_PROBLEM", message: "Problem definition is invalid." }] };
  }
  const attempt = requireRecord(value, "$", issues);
  if (!attempt) return { ok: false, issues };
  if (attempt.schemaVersion !== V2_CONTRACT_VERSION) issue(issues, "$.schemaVersion", "WRONG_CONTRACT_VERSION", `Expected ${V2_CONTRACT_VERSION}.`);
  if (attempt.problemDefinitionId !== problem.id) issue(issues, "$.problemDefinitionId", "WRONG_PROBLEM", "Attempt references a different problem.");
  if (attempt.problemDefinitionVersion !== problem.version) issue(issues, "$.problemDefinitionVersion", "WRONG_PROBLEM_VERSION", "Attempt references a different problem version.");
  requireString(attempt.attemptId, "$.attemptId", issues);
  if (attempt.learnerMode !== "TRY_IT_YOURSELF" && attempt.learnerMode !== "GUIDE_ME") issue(issues, "$.learnerMode", "INVALID_LEARNER_MODE", "Unknown learner mode.");
  if (!modalities.has(String(attempt.modality)) && attempt.modality !== "MIXED") issue(issues, "$.modality", "INVALID_MODALITY", "Unknown attempt modality.");

  const artifactValues = requireArray(attempt.artifacts, "$.artifacts", issues);
  const artifacts = new Map<string, UnknownRecord>();
  const artifactIds = artifactValues.map((artifact, index) => {
    const record = requireRecord(artifact, `$.artifacts[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.artifacts[${index}].id`, issues);
    if (id) artifacts.set(id, record);
    if (!modalities.has(String(record.modality))) issue(issues, `$.artifacts[${index}].modality`, "INVALID_MODALITY", "Unknown artifact modality.");
    requireString(record.mediaType, `$.artifacts[${index}].mediaType`, issues);
    requireString(record.contentRef, `$.artifacts[${index}].contentRef`, issues);
    if (record.modality === "HANDWRITING_IMAGE" || record.modality === "DIGITAL_INK") {
      requirePositiveInteger(
        record.pageCount,
        `$.artifacts[${index}].pageCount`,
        issues,
        "INVALID_PAGE_COUNT",
      );
    }
    return id;
  });
  requireUnique(artifactIds, "$.artifacts", issues);

  const revisionValues = requireArray(attempt.revisions, "$.revisions", issues);
  const revisions = new Map<string, UnknownRecord>();
  const revisionIds = revisionValues.map((revision, index) => {
    const record = requireRecord(revision, `$.revisions[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.revisions[${index}].id`, issues);
    if (id) revisions.set(id, record);
    requirePositiveInteger(record.sequence, `$.revisions[${index}].sequence`, issues);
    requireIsoTimestamp(record.submittedAt, `$.revisions[${index}].submittedAt`, issues);
    requireArray(record.stepIds, `$.revisions[${index}].stepIds`, issues);
    requireArray(record.precededByAssistanceEventIds, `$.revisions[${index}].precededByAssistanceEventIds`, issues);
    if (index > 0 && typeof record.sequence === "number" && typeof (revisionValues[index - 1] as UnknownRecord)?.sequence === "number" && record.sequence <= ((revisionValues[index - 1] as UnknownRecord).sequence as number)) {
      issue(issues, `$.revisions[${index}].sequence`, "UNORDERED_SEQUENCE", "Revision sequences must be increasing.");
    }
    return id;
  });
  requireUnique(revisionIds, "$.revisions", issues);
  requireUnique(revisionValues.map((revision) => isRecord(revision) && typeof revision.sequence === "number" ? revision.sequence : null), "$.revisions[*].sequence", issues);

  const stepValues = requireArray(attempt.steps, "$.steps", issues);
  const stepRecords = new Map<string, UnknownRecord>();
  const stepIds = stepValues.map((step, index) => {
    const record = requireRecord(step, `$.steps[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.steps[${index}].id`, issues);
    if (id) stepRecords.set(id, record);
    const revisionId = requireString(record.revisionId, `$.steps[${index}].revisionId`, issues);
    if (revisionId && !revisions.has(revisionId)) issue(issues, `$.steps[${index}].revisionId`, "UNRESOLVED_REVISION", "Step revision does not exist.");
    validateSource(record.source, `$.steps[${index}].source`, issues, artifacts);
    if (typeof record.rawTranscription !== "string") issue(issues, `$.steps[${index}].rawTranscription`, "EXPECTED_STRING", "Raw transcription is provenance text.");
    if (!semanticTypes.has(String(record.semanticType))) {
      issue(issues, `$.steps[${index}].semanticType`, "INVALID_SEMANTIC_TYPE", "Unknown semantic type.");
    }
    if (record.concept !== null && !concepts.has(String(record.concept))) {
      issue(issues, `$.steps[${index}].concept`, "INVALID_CONCEPT", "Unknown chemistry concept.");
    }
    validateRecognition(
      record.recognition,
      `$.steps[${index}].recognition`,
      issues,
      problem.recognitionPolicy.autoAcceptThreshold,
      problem.recognitionPolicy.localConfirmationThreshold,
    );
    if (record.formulaAst !== undefined) validateExpressionShape(record.formulaAst, `$.steps[${index}].formulaAst`, issues);
    if (record.calculation !== undefined) {
      const calculation = requireRecord(record.calculation, `$.steps[${index}].calculation`, issues);
      if (calculation) {
        validateExpressionShape({ kind: "VARIABLE", reference: calculation.target }, `$.steps[${index}].calculation.targetWrapper`, issues);
        if (
          isRecord(calculation.target) &&
          calculation.target.source === "REASONING_QUANTITY" &&
          (typeof calculation.target.reasoningNodeId !== "string" ||
            !problem.reasoningGraph.nodes[calculation.target.reasoningNodeId])
        ) {
          issue(
            issues,
            `$.steps[${index}].calculation.target.reasoningNodeId`,
            "UNRESOLVED_REASONING_NODE",
            "Calculation target reasoning node does not exist.",
          );
        }
        validateExpressionShape(calculation.expression, `$.steps[${index}].calculation.expression`, issues);
        if (calculation.declaredResult !== undefined) {
          validateQuantityValue(
            calculation.declaredResult,
            `$.steps[${index}].calculation.declaredResult`,
            issues,
          );
        }
      }
    }
    return id;
  });
  requireUnique(stepIds, "$.steps", issues);

  const orderedStepIds = revisionValues.flatMap((revision) =>
    isRecord(revision) && Array.isArray(revision.stepIds) ? revision.stepIds.filter((id): id is string => typeof id === "string") : [],
  );
  const stepOrder = new Map(orderedStepIds.map((id, index) => [id, index]));
  revisionValues.forEach((revision, revisionIndex) => {
    if (!isRecord(revision)) return;
    requireArray(revision.stepIds, `$.revisions[${revisionIndex}].stepIds`, issues).forEach((id, index) => {
      if (typeof id !== "string" || !stepRecords.has(id)) issue(issues, `$.revisions[${revisionIndex}].stepIds[${index}]`, "UNRESOLVED_STEP", "Revision references an unknown step.");
    });
  });
  for (const [id, step] of stepRecords) {
    const memberships = revisionValues.filter((revision) => isRecord(revision) && Array.isArray(revision.stepIds) && revision.stepIds.includes(id));
    if (memberships.length !== 1) issue(issues, `$.steps.${id}`, "INVALID_REVISION_MEMBERSHIP", "Each step must occur in exactly one revision.");
    const expressions = [step.formulaAst, isRecord(step.calculation) ? step.calculation.expression : undefined].filter((candidate): candidate is ExpressionAst => isRecord(candidate) && validateExpressionShape(candidate, `$.steps.${id}.expression`, []));
    for (const expression of expressions) {
      for (const reference of collectVariableReferences(expression)) {
        if (reference.source === "AUTHORED_FACT" && !problem.authoredFacts.some((fact) => fact.id === reference.factId)) issue(issues, `$.steps.${id}.expression`, "UNRESOLVED_FACT", `Unknown fact ${reference.factId}.`);
        if (reference.source === "REASONING_QUANTITY" && !problem.reasoningGraph.nodes[reference.reasoningNodeId]) issue(issues, `$.steps.${id}.expression`, "UNRESOLVED_REASONING_NODE", `Unknown node ${reference.reasoningNodeId}.`);
        if (reference.source === "NORMALIZED_STEP_RESULT") {
          if (!stepRecords.has(reference.stepId)) issue(issues, `$.steps.${id}.expression`, "UNRESOLVED_STEP", `Unknown step ${reference.stepId}.`);
          else if ((stepOrder.get(reference.stepId) ?? Infinity) >= (stepOrder.get(id) ?? -1)) issue(issues, `$.steps.${id}.expression`, "FORWARD_STEP_REFERENCE", `Step ${reference.stepId} must be earlier.`);
        }
      }
    }
  }

  const factUses = requireArray(attempt.factsUsed, "$.factsUsed", issues);
  factUses.forEach((factUse, index) => {
    const record = requireRecord(factUse, `$.factsUsed[${index}]`, issues);
    if (!record) return;
    if (typeof record.factId !== "string" || !problem.authoredFacts.some((fact) => fact.id === record.factId)) issue(issues, `$.factsUsed[${index}].factId`, "UNRESOLVED_FACT", "Unknown authored fact.");
    if (typeof record.observedValue !== "number" && typeof record.observedValue !== "string") {
      issue(issues, `$.factsUsed[${index}].observedValue`, "INVALID_OBSERVED_VALUE", "Observed fact values must be number or string.");
    } else if (typeof record.observedValue === "number") {
      requireFinite(record.observedValue, `$.factsUsed[${index}].observedValue`, issues);
    }
    if (record.unit !== undefined) requireString(record.unit, `$.factsUsed[${index}].unit`, issues);
    requireArray(record.evidenceStepIds, `$.factsUsed[${index}].evidenceStepIds`, issues).forEach((id, evidenceIndex) => {
      if (typeof id !== "string" || !stepRecords.has(id)) issue(issues, `$.factsUsed[${index}].evidenceStepIds[${evidenceIndex}]`, "UNRESOLVED_STEP", "Fact evidence step does not exist.");
    });
  });
  if (attempt.target !== null) {
    const target = requireRecord(attempt.target, "$.target", issues);
    if (target) {
      if (!["KP", "KC", "OTHER"].includes(String(target.quantity))) {
        issue(issues, "$.target.quantity", "INVALID_TARGET_QUANTITY", "Unknown target quantity.");
      }
      requireBoolean(target.explicit, "$.target.explicit", issues);
      requireArray(target.evidenceStepIds, "$.target.evidenceStepIds", issues).forEach((id, index) => {
        if (typeof id !== "string" || !stepRecords.has(id)) issue(issues, `$.target.evidenceStepIds[${index}]`, "UNRESOLVED_STEP", "Target evidence step does not exist.");
      });
    }
  }

  const assistanceValues = requireArray(attempt.assistanceEvents, "$.assistanceEvents", issues);
  const assistance = new Map<string, UnknownRecord>();
  const assistanceIds = assistanceValues.map((event, index) => {
    const record = requireRecord(event, `$.assistanceEvents[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.assistanceEvents[${index}].id`, issues);
    if (id) assistance.set(id, record);
    requirePositiveInteger(record.sequence, `$.assistanceEvents[${index}].sequence`, issues);
    const previousEvent = index > 0 ? assistanceValues[index - 1] : undefined;
    const previousSequence = isRecord(previousEvent) ? previousEvent.sequence : undefined;
    if (
      index > 0 &&
      typeof record.sequence === "number" &&
      typeof previousSequence === "number" &&
      record.sequence <= previousSequence
    ) {
      issue(
        issues,
        `$.assistanceEvents[${index}].sequence`,
        "UNORDERED_SEQUENCE",
        "Assistance sequences must be increasing.",
      );
    }
    const hint = problem.hintPolicy.hints.find(({ id: hintId }) => hintId === record.hintId);
    if (!categories.includes(record.stage as (typeof categories)[number])) {
      issue(issues, `$.assistanceEvents[${index}].stage`, "INVALID_CATEGORY", "Unknown assistance stage.");
    }
    if (![1, 2, 3, 4].includes(record.level as number)) {
      issue(issues, `$.assistanceEvents[${index}].level`, "INVALID_LEVEL", "Assistance level must be 1..4.");
    }
    if (record.trigger !== "LEARNER_REQUEST" && record.trigger !== "CONSECUTIVE_FAILURES") {
      issue(issues, `$.assistanceEvents[${index}].trigger`, "INVALID_TRIGGER", "Unknown assistance trigger.");
    }
    if (!hint) issue(issues, `$.assistanceEvents[${index}].hintId`, "UNRESOLVED_HINT", "Unknown hint.");
    else {
      if (record.stage !== hint.stage || record.level !== hint.level) issue(issues, `$.assistanceEvents[${index}]`, "HINT_METADATA_MISMATCH", "Assistance must match its authored hint.");
      if (JSON.stringify(record.revealedReasoningNodeIds) !== JSON.stringify(hint.revealedReasoningNodeIds) || JSON.stringify(record.revealedContentIds) !== JSON.stringify(hint.revealedContentIds)) issue(issues, `$.assistanceEvents[${index}]`, "HINT_REVEAL_MISMATCH", "Assistance reveal references must match the hint.");
    }
    requireIsoTimestamp(record.timestamp, `$.assistanceEvents[${index}].timestamp`, issues);
    return id;
  });
  requireUnique(assistanceIds, "$.assistanceEvents", issues);
  requireUnique([...revisionValues, ...assistanceValues].map((entry) => isRecord(entry) && typeof entry.sequence === "number" ? entry.sequence : null), "$.*.sequence", issues);
  revisionValues.forEach((revision, revisionIndex) => {
    if (!isRecord(revision)) return;
    requireArray(revision.precededByAssistanceEventIds, `$.revisions[${revisionIndex}].precededByAssistanceEventIds`, issues).forEach((id, index) => {
      const event = typeof id === "string" ? assistance.get(id) : undefined;
      if (!event) issue(issues, `$.revisions[${revisionIndex}].precededByAssistanceEventIds[${index}]`, "UNRESOLVED_ASSISTANCE", "Revision assistance does not exist.");
      else if (typeof event.sequence === "number" && typeof revision.sequence === "number" && event.sequence >= revision.sequence) issue(issues, `$.revisions[${revisionIndex}].precededByAssistanceEventIds[${index}]`, "ASSISTANCE_AFTER_REVISION", "Assistance must precede its revision.");
      if (event && typeof event.timestamp === "string" && typeof revision.submittedAt === "string" && Date.parse(event.timestamp) >= Date.parse(revision.submittedAt)) issue(issues, `$.revisions[${revisionIndex}].precededByAssistanceEventIds[${index}]`, "ASSISTANCE_TIMESTAMP_AFTER_REVISION", "Assistance timestamp must precede submission.");
    });
  });

  const recognitionIssues = requireArray(attempt.recognitionIssues, "$.recognitionIssues", issues);
  const recognitionIssueIds = recognitionIssues.map((recognitionIssue, index) => {
    const record = requireRecord(recognitionIssue, `$.recognitionIssues[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.recognitionIssues[${index}].id`, issues);
    if (record.scope === "STEP") {
      if (typeof record.stepId !== "string" || !stepRecords.has(record.stepId)) issue(issues, `$.recognitionIssues[${index}].stepId`, "UNRESOLVED_STEP", "Recognition issue step does not exist.");
      else if ((stepRecords.get(record.stepId)?.recognition as RecognitionEvidence | undefined)?.status === "AUTO_ACCEPTED") issue(issues, `$.recognitionIssues[${index}].stepId`, "RESOLVED_STEP_ISSUE", "An auto-accepted step cannot retain an unresolved issue.");
    } else if (record.scope === "ARTIFACT") {
      if (typeof record.artifactId !== "string" || !artifacts.has(record.artifactId)) issue(issues, `$.recognitionIssues[${index}].artifactId`, "MISSING_ARTIFACT", "Recognition issue artifact does not exist.");
      validateRecognition(
        record.recognition,
        `$.recognitionIssues[${index}].recognition`,
        issues,
        problem.recognitionPolicy.autoAcceptThreshold,
        problem.recognitionPolicy.localConfirmationThreshold,
      );
    } else if (record.scope === "REGION") {
      validateSource(record.source, `$.recognitionIssues[${index}].source`, issues, artifacts);
      validateRecognition(
        record.recognition,
        `$.recognitionIssues[${index}].recognition`,
        issues,
        problem.recognitionPolicy.autoAcceptThreshold,
        problem.recognitionPolicy.localConfirmationThreshold,
      );
    } else issue(issues, `$.recognitionIssues[${index}].scope`, "INVALID_ISSUE_SCOPE", "Unknown recognition issue scope.");
    return id;
  });
  requireUnique(recognitionIssueIds, "$.recognitionIssues", issues);

  if (attempt.finalAnswer !== null) {
    const finalAnswer = requireRecord(attempt.finalAnswer, "$.finalAnswer", issues);
    if (finalAnswer) {
      validateQuantityValue(finalAnswer, "$.finalAnswer", issues);
      if (finalAnswer.significantFigures !== undefined) {
        requireString(finalAnswer.raw, "$.finalAnswer.raw", issues);
        const hasSource = stepValues.some((step) => isRecord(step) && isRecord(step.calculation) && isRecord(step.calculation.declaredResult) && step.calculation.declaredResult.value === finalAnswer.value && step.calculation.declaredResult.raw === finalAnswer.raw);
        if (!hasSource) issue(issues, "$.finalAnswer", "MISSING_FINAL_SOURCE_EVIDENCE", "Significant figures require matching declared-result raw evidence.");
      }
    }
  }
  return issues.length === 0 ? { ok: true, value: value as NormalizedAttempt } : { ok: false, issues };
}

const failureCategory: Readonly<Record<string, (typeof categories)[number]>> = {
  RELEVANT_DATA_OMITTED: "DATA_EXTRACTION",
  IRRELEVANT_DATA_USED: "DATA_EXTRACTION",
  TARGET_MISIDENTIFIED: "TARGET_IDENTIFICATION",
  WRONG_METHOD: "STRATEGY",
  MISSING_REASONING_LINK: "STRATEGY",
  UNSUPPORTED_ASSUMPTION: "STRATEGY",
  WRONG_FORMULA: "FORMULA",
  WRONG_SPECIES: "FORMULA",
  WRONG_STOICHIOMETRIC_POWER: "FORMULA",
  INVERTED_RELATION: "FORMULA",
  WRONG_VALUE_SUBSTITUTED: "SUBSTITUTION",
  WRONG_DEPENDENCY_USED: "SUBSTITUTION",
  ARITHMETIC_ERROR: "ARITHMETIC",
  UNIT_ERROR: "UNIT",
  SIGNIFICANT_FIGURES_ERROR: "PRECISION",
};

export function validateDiagnosticEvidenceTraceV2(
  value: unknown,
  problem: DiagnosticProblemDefinitionV2,
): ValidationResult<DiagnosticEvidenceTraceV2> {
  const issues: ValidationIssue[] = [];
  const trace = requireRecord(value, "$", issues);
  if (!trace) return { ok: false, issues };
  const versions: readonly [string, unknown, string][] = [
    ["schemaVersion", trace.schemaVersion, V2_CONTRACT_VERSION],
    ["problemDefinitionId", trace.problemDefinitionId, problem.id],
    ["problemDefinitionVersion", trace.problemDefinitionVersion, problem.version],
    ["reasoningGraphVersion", trace.reasoningGraphVersion, problem.reasoningGraph.version],
    ["diagnosisPolicyVersion", trace.diagnosisPolicyVersion, problem.diagnosisPolicyVersion],
    ["recognitionPolicyVersion", trace.recognitionPolicyVersion, problem.recognitionPolicy.version],
    ["hintPolicyVersion", trace.hintPolicyVersion, problem.hintPolicy.version],
  ];
  versions.forEach(([field, observed, expected]) => {
    if (observed !== expected) issue(issues, `$.${field}`, "VERSION_MISMATCH", `Expected ${expected}.`);
  });
  requireString(trace.traceId, "$.traceId", issues);
  requireString(trace.attemptId, "$.attemptId", issues);
  requireIsoTimestamp(trace.submittedAt, "$.submittedAt", issues);
  if (!diagnosisDecisions.has(String(trace.decision))) {
    issue(issues, "$.decision", "INVALID_DIAGNOSIS_DECISION", "Unknown diagnosis decision.");
  }
  if (!supportOutcomes.has(String(trace.attemptSupportOutcome))) {
    issue(issues, "$.attemptSupportOutcome", "INVALID_SUPPORT_OUTCOME", "Unknown support outcome.");
  }
  const interpreter = requireRecord(trace.interpreter, "$.interpreter", issues);
  if (interpreter && !["STRUCTURED_ADAPTER", "TYPED_WORKING_MOCK", "MULTIMODAL_MODEL"].includes(String(interpreter.kind))) issue(issues, "$.interpreter.kind", "INVALID_INTERPRETER", "Unknown interpreter kind.");
  if (interpreter) {
    for (const field of ["adapterVersion", "modelVersion", "promptVersion"] as const) {
      if (interpreter[field] !== undefined && typeof interpreter[field] !== "string") {
        issue(
          issues,
          `$.interpreter.${field}`,
          "INVALID_INTERPRETER_METADATA",
          "Interpreter version metadata must be a string.",
        );
      }
    }
  }

  const evaluations = requireArray(trace.stageEvaluations, "$.stageEvaluations", issues);
  if (evaluations.length !== categories.length) issue(issues, "$.stageEvaluations", "INVALID_STAGE_COUNT", "All eight stages are required.");
  const observedCategories: string[] = [];
  evaluations.forEach((evaluation, index) => {
    const record = requireRecord(evaluation, `$.stageEvaluations[${index}]`, issues);
    if (!record) return;
    if (typeof record.category === "string") observedCategories.push(record.category);
    if (record.category !== categories[index]) issue(issues, `$.stageEvaluations[${index}].category`, "INVALID_STAGE_ORDER", "Stages must follow pedagogical category order.");
    if (!evaluationStatuses.has(String(record.status))) {
      issue(issues, `$.stageEvaluations[${index}].status`, "INVALID_EVALUATION_STATUS", "Unknown evaluation status.");
    }
    const incorrect = record.status === "INCORRECT";
    if (incorrect && (typeof record.failureCode !== "string" || failureCategory[record.failureCode] !== record.category)) issue(issues, `$.stageEvaluations[${index}].failureCode`, "INVALID_STAGE_FAILURE_PAIR", "Incorrect stages require a matching failure code.");
    if (!incorrect && record.failureCode !== null) issue(issues, `$.stageEvaluations[${index}].failureCode`, "FAILURE_WITHOUT_INCORRECT_STAGE", "Only incorrect stages carry failure codes.");
    requireArray(record.evidenceStepIds, `$.stageEvaluations[${index}].evidenceStepIds`, issues);
  });
  requireUnique(observedCategories, "$.stageEvaluations", issues);
  const firstIncorrect = evaluations.find((evaluation) => isRecord(evaluation) && evaluation.status === "INCORRECT") as UnknownRecord | undefined;
  if ((firstIncorrect?.category ?? null) !== trace.firstPedagogicalError || (firstIncorrect?.failureCode ?? null) !== trace.failureCode) issue(issues, "$.firstPedagogicalError", "INVALID_FIRST_ERROR", "Trace first error must match the first incorrect stage.");

  const gate = trace.recognitionGateDecision;
  if (!["PASSED", "REQUIRES_CONFIRMATION", "ABSTAINED"].includes(String(gate))) issue(issues, "$.recognitionGateDecision", "INVALID_RECOGNITION_GATE", "Unknown gate decision.");
  if (gate !== "PASSED" && (trace.decision !== "RECOGNITION_UNCERTAIN" || trace.failureCode !== null || trace.firstPedagogicalError !== null)) issue(issues, "$.decision", "INVALID_GATED_DECISION", "Recognition-gated traces cannot claim a student error.");
  if (gate === "PASSED" && firstIncorrect && !["STUDENT_ERROR", "NOT_SOLVED"].includes(String(trace.decision))) issue(issues, "$.decision", "INVALID_ERROR_DECISION", "An incorrect stage requires an error decision.");
  if (gate === "PASSED" && !firstIncorrect && trace.decision === "STUDENT_ERROR") issue(issues, "$.decision", "ERROR_WITHOUT_INCORRECT_STAGE", "Student error requires an incorrect stage.");

  const recognitionIssues = requireArray(trace.recognitionIssues, "$.recognitionIssues", issues);
  const impliedNonPassed = recognitionIssues.some((entry) => isRecord(entry) && entry.scope !== "STEP" && isRecord(entry.recognition) && (entry.recognition.status === "ABSTAINED" || entry.recognition.status === "REQUIRES_CONFIRMATION"));
  if (impliedNonPassed && gate === "PASSED") issue(issues, "$.recognitionGateDecision", "UNRESOLVED_RECOGNITION_PASSED", "Unresolved recognition cannot pass the gate.");
  requireArray(trace.alignmentEvidence, "$.alignmentEvidence", issues).forEach((entry, index) => {
    const record = requireRecord(entry, `$.alignmentEvidence[${index}]`, issues);
    if (!record) return;
    requireString(record.normalizedStepId, `$.alignmentEvidence[${index}].normalizedStepId`, issues);
    if (!reasoningEvidenceKinds.has(String(record.evidenceKind))) {
      issue(issues, `$.alignmentEvidence[${index}].evidenceKind`, "INVALID_EVIDENCE_KIND", "Unknown alignment evidence kind.");
    }
    validateProbability(record.confidence, `$.alignmentEvidence[${index}].confidence`, issues);
  });
  const checkValues = requireArray(trace.deterministicChecks, "$.deterministicChecks", issues);
  if (
    checkValues.length !== categories.length &&
    !(gate !== "PASSED" && checkValues.length === 0)
  ) {
    issue(issues, "$.deterministicChecks", "INVALID_CHECK_COUNT", "All eight deterministic checks are required.");
  }
  checkValues.forEach((entry, index) => {
    const record = requireRecord(entry, `$.deterministicChecks[${index}]`, issues);
    if (!record) return;
    if (record.category !== categories[index]) {
      issue(issues, `$.deterministicChecks[${index}].category`, "INVALID_CHECK_ORDER", "Checks must follow category order.");
    }
    if (!["PASS", "FAIL", "NOT_RUN"].includes(String(record.outcome))) {
      issue(issues, `$.deterministicChecks[${index}].outcome`, "INVALID_CHECK_OUTCOME", "Unknown deterministic check outcome.");
    }
    requireString(record.toolVersion, `$.deterministicChecks[${index}].toolVersion`, issues);
    requireArray(record.stepIds, `$.deterministicChecks[${index}].stepIds`, issues);
  });
  const traceAssistanceValues = requireArray(
    trace.assistanceEvents,
    "$.assistanceEvents",
    issues,
  );
  const traceAssistance = new Map<string, UnknownRecord>();
  const traceAssistanceIds = traceAssistanceValues.map((event, index) => {
    const record = requireRecord(event, `$.assistanceEvents[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.assistanceEvents[${index}].id`, issues);
    if (id) traceAssistance.set(id, record);
    requirePositiveInteger(record.sequence, `$.assistanceEvents[${index}].sequence`, issues);
    requireIsoTimestamp(record.timestamp, `$.assistanceEvents[${index}].timestamp`, issues);
    if (!categories.includes(record.stage as (typeof categories)[number])) {
      issue(issues, `$.assistanceEvents[${index}].stage`, "INVALID_CATEGORY", "Unknown assistance stage.");
    }
    if (![1, 2, 3, 4].includes(record.level as number)) {
      issue(issues, `$.assistanceEvents[${index}].level`, "INVALID_LEVEL", "Assistance level must be 1..4.");
    }
    if (record.trigger !== "LEARNER_REQUEST" && record.trigger !== "CONSECUTIVE_FAILURES") {
      issue(issues, `$.assistanceEvents[${index}].trigger`, "INVALID_TRIGGER", "Unknown assistance trigger.");
    }
    if (!problem.hintPolicy.hints.some((hint) => hint.id === record.hintId)) {
      issue(
        issues,
        `$.assistanceEvents[${index}].hintId`,
        "UNRESOLVED_HINT",
        "Trace assistance references an unknown hint.",
      );
    }
    return id;
  });
  requireUnique(traceAssistanceIds, "$.assistanceEvents", issues);
  const traceRevisionValues = requireArray(trace.revisions, "$.revisions", issues);
  const traceRevisionIds = traceRevisionValues.map((revision, index) => {
    const record = requireRecord(revision, `$.revisions[${index}]`, issues);
    if (!record) return null;
    const id = requireString(record.id, `$.revisions[${index}].id`, issues);
    requirePositiveInteger(record.sequence, `$.revisions[${index}].sequence`, issues);
    requireIsoTimestamp(record.submittedAt, `$.revisions[${index}].submittedAt`, issues);
    requireArray(record.stepIds, `$.revisions[${index}].stepIds`, issues);
    requireArray(
      record.precededByAssistanceEventIds,
      `$.revisions[${index}].precededByAssistanceEventIds`,
      issues,
    ).forEach((eventId, eventIndex) => {
      const event = typeof eventId === "string" ? traceAssistance.get(eventId) : undefined;
      if (!event) {
        issue(
          issues,
          `$.revisions[${index}].precededByAssistanceEventIds[${eventIndex}]`,
          "UNRESOLVED_ASSISTANCE",
          "Trace revision assistance does not exist.",
        );
      } else if (
        typeof event.sequence === "number" &&
        typeof record.sequence === "number" &&
        event.sequence >= record.sequence
      ) {
        issue(
          issues,
          `$.revisions[${index}].precededByAssistanceEventIds[${eventIndex}]`,
          "ASSISTANCE_AFTER_REVISION",
          "Trace assistance must precede its revision.",
        );
      }
    });
    return id;
  });
  requireUnique(traceRevisionIds, "$.revisions", issues);
  requireUnique(
    [...traceAssistanceValues, ...traceRevisionValues].map((entry) =>
      isRecord(entry) && typeof entry.sequence === "number" ? entry.sequence : null,
    ),
    "$.*.sequence",
    issues,
  );
  return issues.length === 0 ? { ok: true, value: value as DiagnosticEvidenceTraceV2 } : { ok: false, issues };
}
