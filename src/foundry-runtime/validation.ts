import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import canonicalComponentSchema from "../published-components/diagnostic-learning-component.schema.json";
import { STANDARD_TRAINER_CAPABILITY } from "./capability";
import { computeContentHash } from "./contentHash";
import type { ExpressionAst, PublishedDiagnosticLearningComponent, ValidationResult } from "./types";

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const issue = (path: string, code: string, message: string) => ({ path, code, message });
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validateCanonicalComponent = ajv.compile(canonicalComponentSchema);

function schemaIssue(error: ErrorObject) {
  const suffix = error.params && "missingProperty" in error.params ? `/${String(error.params.missingProperty)}` : "";
  return issue(`${error.instancePath || "$"}${suffix}`, `SCHEMA_${error.keyword.toUpperCase()}`, error.message ?? `Failed ${error.keyword} validation.`);
}

function expressionKinds(expression: ExpressionAst): readonly string[] {
  if (expression.kind === "BINARY") return ["BINARY", ...expressionKinds(expression.left), ...expressionKinds(expression.right)];
  if (expression.kind === "FUNCTION") return [`FUNCTION:${expression.name}`, ...expression.arguments.flatMap(expressionKinds)];
  return [expression.kind];
}

function expressionReferences(expression: ExpressionAst): readonly { readonly source: string; readonly id: string }[] {
  if (expression.kind === "VARIABLE") return [{ source: expression.reference.source, id: expression.reference.source === "AUTHORED_FACT" ? expression.reference.factId : expression.reference.reasoningNodeId }];
  if (expression.kind === "BINARY") return [...expressionReferences(expression.left), ...expressionReferences(expression.right)];
  if (expression.kind === "FUNCTION") return expression.arguments.flatMap(expressionReferences);
  return [];
}

export function unwrapPublishedSnapshot(value: unknown): unknown {
  return isRecord(value) && "component" in value ? value.component : value;
}

export function validatePublishedComponent(value: unknown): { readonly ok: true; readonly value: PublishedDiagnosticLearningComponent } | { readonly ok: false; readonly issues: readonly ReturnType<typeof issue>[] } {
  const raw = unwrapPublishedSnapshot(value);
  if (!validateCanonicalComponent(raw)) return { ok: false, issues: (validateCanonicalComponent.errors ?? []).map(schemaIssue) };
  if (!isRecord(raw) || raw.status !== "PUBLISHED") return { ok: false, issues: [issue("$.status", "NOT_PUBLISHED", "Runtime only accepts PUBLISHED components.")] };
  if (!isRecord(raw.review)) return { ok: false, issues: [issue("$.review", "MISSING_REVIEW", "Published components require review metadata.")] };
  if (!isRecord(raw.publication)) return { ok: false, issues: [issue("$.publication", "MISSING_PUBLICATION", "Published components require publication metadata.")] };
  if (isRecord(raw.provenance) && raw.provenance.origin === "MIGRATED" && !isRecord(raw.migration)) return { ok: false, issues: [issue("$.migration", "MISSING_MIGRATION_METADATA", "Migrated components must declare migration fidelity and omitted capabilities.")] };
  const component = raw as unknown as PublishedDiagnosticLearningComponent;
  const issues: ReturnType<typeof issue>[] = [];
  if (!STANDARD_TRAINER_CAPABILITY.supportedSchemaVersions.includes(component.schemaVersion)) issues.push(issue("$.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", `Schema ${component.schemaVersion} is unsupported.`));
  if (!component.publication.contentHash || computeContentHash(component) !== component.publication.contentHash) issues.push(issue("$.publication.contentHash", "CONTENT_HASH_MISMATCH", "Published component content does not match its manifest hash."));
  if (!STANDARD_TRAINER_CAPABILITY.supportedTargetKinds.includes(component.target.kind)) issues.push(issue("$.target.kind", "UNSUPPORTED_TARGET_KIND", `No adapter exists for ${component.target.kind}.`));
  const nodeIds = new Set(Object.keys(component.reasoningGraph.nodes));
  const factIds = new Set(component.authoredFacts.map((fact) => fact.id));
  const formulaTargets = new Set(component.formulaDefinitions.map((formula) => formula.targetReasoningNodeId));
  if (component.reasoningGraph.pedagogicalOrder.some((id) => !nodeIds.has(id))) issues.push(issue("$.reasoningGraph.pedagogicalOrder", "UNRESOLVED_NODE", "Pedagogical order contains an unknown node."));
  for (const node of Object.values(component.reasoningGraph.nodes)) for (const dependency of node.dependencies) if (!nodeIds.has(dependency)) issues.push(issue(`$.reasoningGraph.nodes.${node.id}.dependencies`, "UNRESOLVED_DEPENDENCY", dependency));
  for (const formula of component.formulaDefinitions) {
    if (!nodeIds.has(formula.targetReasoningNodeId)) issues.push(issue(`$.formulaDefinitions.${formula.id}`, "UNRESOLVED_FORMULA_TARGET", formula.targetReasoningNodeId));
    for (const reference of expressionReferences(formula.expression)) if (reference.source === "AUTHORED_FACT" ? !factIds.has(reference.id) : !formulaTargets.has(reference.id)) issues.push(issue(`$.formulaDefinitions.${formula.id}`, "UNRESOLVED_EXPRESSION_REFERENCE", reference.id));
    for (const kind of expressionKinds(formula.expression)) if (!STANDARD_TRAINER_CAPABILITY.supportedExpressionNodes.includes(kind)) issues.push(issue(`$.formulaDefinitions.${formula.id}`, "UNSUPPORTED_EXPRESSION_NODE", kind));
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: component };
}

export function validateAttempt(component: PublishedDiagnosticLearningComponent, attempt: NormalizedAttemptLike): ValidationResult {
  const issues = [];
  if (attempt.componentId !== component.id || attempt.componentVersion !== component.version) issues.push(issue("$attempt", "COMPONENT_VERSION_MISMATCH", "Attempt must be pinned to the selected published component version."));
  if (!Number.isFinite(attempt.finalAnswer.value) || !Number.isInteger(attempt.finalAnswer.significantFigures) || attempt.finalAnswer.significantFigures < 1) issues.push(issue("$attempt.finalAnswer", "INVALID_FINAL_ANSWER", "Final answer value and precision must be finite and positive."));
  return issues.length ? { ok: false, issues } : { ok: true };
}

interface NormalizedAttemptLike { readonly componentId: string; readonly componentVersion: string; readonly finalAnswer: { readonly value: number; readonly significantFigures: number } }
