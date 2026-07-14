import { useState } from "react";
import { evaluateCalculationPath } from "./domain/calculationPathEngine";
import {
  CalculationTraceArchive,
  exportTraceJson,
  type StorageLike,
} from "./domain/evidenceArchive";
import type {
  CalculationEvidenceTrace,
  SolutionStepDefinition,
  StepEvaluation,
  StudentStepInput,
} from "./domain/types";
import { kpFromEquilibriumMoles } from "./fixtures/kpFromEquilibriumMoles";

interface StepDraft {
  numericValue: string;
  expression: string;
  unit: string;
  significantFigures: string;
}

interface AppProps {
  readonly storage?: StorageLike | null;
  readonly now?: () => string;
  readonly createAttemptId?: () => string;
}

function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function defaultAttemptId(): string {
  return `kp-attempt-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

function emptyDrafts(): Record<string, StepDraft> {
  return Object.fromEntries(
    kpFromEquilibriumMoles.solutionGraph.orderedStepIds.map((stepId) => [
      stepId,
      { numericValue: "", expression: "", unit: "", significantFigures: "" },
    ]),
  );
}

function toStudentInput(draft: StepDraft): StudentStepInput | null {
  const hasValue = Object.values(draft).some((value) => value.trim() !== "");
  if (!hasValue) {
    return null;
  }
  return {
    ...(draft.numericValue.trim() === ""
      ? {}
      : { numericValue: Number(draft.numericValue) }),
    ...(draft.expression.trim() === "" ? {} : { expression: draft.expression.trim() }),
    ...(draft.unit.trim() === "" ? {} : { unit: draft.unit.trim() }),
    ...(draft.significantFigures.trim() === ""
      ? {}
      : { significantFigures: Number(draft.significantFigures) }),
  };
}

function resultHeading(trace: CalculationEvidenceTrace): string {
  if (trace.decision === "VALID_PATH") {
    return "Calculation path verified";
  }
  if (trace.decision === "INCOMPLETE_PATH") {
    return "Calculation path is incomplete";
  }
  return "Calculation path needs diagnosis";
}

function persistenceCopy(trace: CalculationEvidenceTrace): string {
  if (trace.persistenceStatus === "PERSISTED") {
    return "Saved in this browser";
  }
  if (trace.persistenceStatus === "MEMORY_ONLY") {
    return "Current tab only — export before leaving";
  }
  return "Not archived — export this trace before leaving";
}

function downloadTrace(trace: CalculationEvidenceTrace): void {
  const blob = new Blob([exportTraceJson(trace)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${trace.attemptId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StepInput({
  step,
  index,
  draft,
  evaluation,
  onChange,
}: {
  readonly step: SolutionStepDefinition;
  readonly index: number;
  readonly draft: StepDraft;
  readonly evaluation?: StepEvaluation;
  readonly onChange: (next: StepDraft) => void;
}) {
  const descriptionId = `${step.id}-description`;
  const errorId = `${step.id}-error`;
  const isInvalid = evaluation?.status === "INVALID";
  return (
    <fieldset
      className={`path-step${isInvalid ? " path-step--invalid" : ""}`}
      data-testid="path-step"
    >
      <legend>
        <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
        {step.label}
      </legend>
      <p id={descriptionId}>{step.instruction}</p>
      {step.dependencies.length > 0 ? (
        <p className="dependencies">
          Depends on: {step.dependencies.map((dependency) => dependency).join(", ")}
        </p>
      ) : (
        <p className="dependencies">Independent starting step</p>
      )}
      <div className="input-row">
        {step.expected.numericValue !== undefined ? (
          <label>
            Numeric value
            <input
              aria-describedby={isInvalid ? `${descriptionId} ${errorId}` : descriptionId}
              aria-invalid={isInvalid}
              autoComplete="off"
              inputMode="decimal"
              name={`${step.id}-numericValue`}
              step="any"
              type="number"
              value={draft.numericValue}
              onChange={(event) => onChange({ ...draft, numericValue: event.target.value })}
            />
          </label>
        ) : null}
        {step.expected.expressionVariants ? (
          <label className="input-wide">
            Expression
            <input
              aria-describedby={isInvalid ? `${descriptionId} ${errorId}` : descriptionId}
              aria-invalid={isInvalid}
              autoComplete="off"
              name={`${step.id}-expression`}
              type="text"
              value={draft.expression}
              onChange={(event) => onChange({ ...draft, expression: event.target.value })}
            />
          </label>
        ) : null}
        {step.expected.acceptedUnits.length > 0 ? (
          <label>
            Unit
            <input
              aria-describedby={isInvalid ? `${descriptionId} ${errorId}` : descriptionId}
              aria-invalid={isInvalid}
              autoComplete="off"
              name={`${step.id}-unit`}
              type="text"
              value={draft.unit}
              onChange={(event) => onChange({ ...draft, unit: event.target.value })}
            />
          </label>
        ) : null}
        {step.expected.significantFigures !== undefined ? (
          <label>
            Significant figures
            <input
              aria-describedby={isInvalid ? `${descriptionId} ${errorId}` : descriptionId}
              aria-invalid={isInvalid}
              autoComplete="off"
              inputMode="numeric"
              min="1"
              name={`${step.id}-significantFigures`}
              step="1"
              type="number"
              value={draft.significantFigures}
              onChange={(event) =>
                onChange({ ...draft, significantFigures: event.target.value })
              }
            />
          </label>
        ) : null}
      </div>
      {isInvalid ? (
        <p className="step-error" id={errorId} role="alert">
          {evaluation.message}
        </p>
      ) : null}
    </fieldset>
  );
}

function TraceResult({ trace }: { readonly trace: CalculationEvidenceTrace }) {
  const invalid = trace.stepEvaluations.find(
    (step) => step.stepId === trace.firstInvalidStepId,
  );
  const invalidDefinition = invalid
    ? kpFromEquilibriumMoles.solutionGraph.steps[invalid.stepId]
    : null;
  return (
    <section className={`result result--${trace.decision.toLowerCase()}`} aria-live="polite">
      <p className="eyebrow">Deterministic result · {trace.decision}</p>
      <h2>{resultHeading(trace)}</h2>
      {invalid && invalidDefinition ? (
        <div className="invalid-step">
          <p>
            First invalid step: <strong>{invalidDefinition.label}</strong>
          </p>
          <p>{invalid.message}</p>
          <code>{invalid.failureCode}</code>
        </div>
      ) : (
        <p>All seven submitted steps match the canonical solution graph.</p>
      )}
      <p className="persistence-copy">{persistenceCopy(trace)}</p>
      <button className="button button--secondary" type="button" onClick={() => downloadTrace(trace)}>
        Export evidence JSON
      </button>
    </section>
  );
}

export default function App({ storage, now, createAttemptId }: AppProps) {
  const [archive] = useState(
    () => new CalculationTraceArchive(storage === undefined ? browserStorage() : storage ?? undefined),
  );
  const [drafts, setDrafts] = useState<Record<string, StepDraft>>(emptyDrafts);
  const [currentTrace, setCurrentTrace] = useState<CalculationEvidenceTrace | null>(null);
  const [traces, setTraces] = useState<readonly CalculationEvidenceTrace[]>(() => archive.list());

  function submitPath(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const steps = Object.fromEntries(
      Object.entries(drafts)
        .map(([stepId, draft]) => [stepId, toStudentInput(draft)] as const)
        .filter((entry): entry is readonly [string, StudentStepInput] => entry[1] !== null),
    );
    const evaluated = evaluateCalculationPath(kpFromEquilibriumMoles, {
      attemptId: createAttemptId?.() ?? defaultAttemptId(),
      submittedAt: now?.() ?? new Date().toISOString(),
      steps,
    });
    const saved = archive.save(evaluated);
    setCurrentTrace(saved.trace ?? { ...evaluated, persistenceStatus: "FAILED" });
    setTraces(archive.list());
  }

  return (
    <main>
      <a className="skip-link" href="#path-heading">
        Skip to calculation steps
      </a>
      <header className="hero">
        <div>
          <p className="eyebrow">Calculation-path engine · Core proof</p>
          <h1>{kpFromEquilibriumMoles.title}</h1>
          <p className="hero-copy">
            Enter each calculation step separately. The engine stops at the first invalid step
            in the canonical dependency path.
          </p>
        </div>
        <div className="engine-badge">Deterministic tools only · No LLM call</div>
      </header>

      <div className="workbench">
        <aside className="problem-panel" aria-labelledby="problem-heading">
          <p className="panel-label">Curated problem</p>
          <h2 id="problem-heading">{kpFromEquilibriumMoles.reaction}</h2>
          <p>{kpFromEquilibriumMoles.prompt}</p>
          <dl className="givens">
            {kpFromEquilibriumMoles.givens.map((given) => (
              <div key={given.label}>
                <dt>{given.label}</dt>
                <dd>{given.value}</dd>
              </div>
            ))}
          </dl>
          <p className="version-copy">
            Problem v{kpFromEquilibriumMoles.version} · Graph v
            {kpFromEquilibriumMoles.solutionGraph.version}
          </p>
        </aside>

        <section className="path-panel" aria-labelledby="path-heading">
          <div className="section-heading">
            <div>
              <p className="panel-label">Structured student steps</p>
              <h2 id="path-heading">Build the calculation path</h2>
            </div>
            <span>{kpFromEquilibriumMoles.solutionGraph.orderedStepIds.length} steps</span>
          </div>
          <form onSubmit={submitPath}>
            {kpFromEquilibriumMoles.solutionGraph.orderedStepIds.map((stepId, index) => (
              <StepInput
                key={stepId}
                step={kpFromEquilibriumMoles.solutionGraph.steps[stepId]}
                index={index}
                draft={drafts[stepId]}
                evaluation={currentTrace?.stepEvaluations.find(
                  (evaluation) => evaluation.stepId === stepId,
                )}
                onChange={(next) => setDrafts((current) => ({ ...current, [stepId]: next }))}
              />
            ))}
            <button className="button button--primary" type="submit">
              Check calculation path
            </button>
          </form>
        </section>

        <aside className="evidence-panel" aria-labelledby="evidence-heading">
          <p className="panel-label">Evidence trace</p>
          <h2 id="evidence-heading">First-invalid-step diagnosis</h2>
          {currentTrace ? (
            <TraceResult trace={currentTrace} />
          ) : (
            <p className="empty-state">
              Submit the structured path to create a versioned deterministic trace.
            </p>
          )}
          {traces.length > 0 ? (
            <div className="archive-list">
              <h3>Evidence archive</h3>
              {traces.map((trace) => (
                <article key={trace.traceId}>
                  <span>{trace.decision.replaceAll("_", " ")}</span>
                  <small>{trace.persistenceStatus.replaceAll("_", " ")}</small>
                </article>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
