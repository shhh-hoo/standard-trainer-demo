import { useState } from "react";
import {
  AttemptArchive,
  exportAttemptJson,
  type StorageLike,
} from "./domain/evidenceArchive";
import type { AttemptRecord, JudgementResult } from "./domain/types";
import {
  createWorkflowState,
  revealReference,
  submitFirstAnswer,
  submitRewrite,
  withPersistenceStatus,
  type WorkflowDependencies,
  type WorkflowState,
} from "./domain/workflow";
import { activeDynamicEquilibriumStandard } from "./fixtures/dynamicEquilibriumStandard";
import { legacyDynamicEquilibriumDefinition } from "./fixtures/legacyItems";

const curriculum = Object.freeze({
  board: "Cambridge International",
  syllabusCode: "9701",
  syllabusCycle: "2025-2027",
});

function createId(kind: "attempt" | "trace"): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${kind}-${random}`;
}

function getBrowserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function decisionLabel(result: JudgementResult): string {
  if (result.decision === "PASS") {
    return "Meets current AI-draft rubric";
  }
  if (result.decision === "REWRITE") {
    return "Revise against the current draft rubric";
  }
  if (result.decision === "REVIEW") {
    return "Held for curriculum review";
  }
  return "Standard unavailable for this context";
}

function persistenceLabel(attempt: AttemptRecord): string {
  if (attempt.persistenceStatus === "PERSISTED") {
    return "Saved in this browser";
  }
  if (attempt.persistenceStatus === "MEMORY_ONLY") {
    return "Current tab only — export before leaving";
  }
  return "Not saved";
}

function persistenceWarning(attempt: AttemptRecord): string | null {
  if (attempt.persistenceStatus === "MEMORY_ONLY") {
    return "This attempt is available only in the current tab. Export it before leaving.";
  }
  if (attempt.persistenceStatus === "FAILED") {
    return "This attempt could not be archived. Keep this page open while you retain the response.";
  }
  return null;
}

function downloadAttempt(attempt: AttemptRecord): void {
  const blob = new Blob([exportAttemptJson(attempt)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${attempt.attemptId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FindingList({
  title,
  ids,
  tone,
}: {
  title: string;
  ids: readonly string[];
  tone: "positive" | "warning" | "danger";
}) {
  if (ids.length === 0) {
    return null;
  }

  const node = activeDynamicEquilibriumStandard.node;
  const labels = ids.map((id) => {
    const element = node.requiredElements.find((candidate) => candidate.id === id);
    const dangerous = node.dangerousClaims.find((candidate) => candidate.id === id);
    return element?.description ?? dangerous?.reason ?? id;
  });

  return (
    <section className={`finding finding--${tone}`}>
      <h3>{title}</h3>
      <ul>
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </section>
  );
}

function Feedback({ result }: { result: JudgementResult }) {
  return (
    <div className={`feedback feedback--${result.decision.toLowerCase()}`}>
      <p className="feedback__eyebrow">Internal decision · {result.decision}</p>
      <h2>{decisionLabel(result)}</h2>
      <p className="feedback__authority">
        Authority: {result.authorityScope.replaceAll("_", " ")} · {result.sourceStatus} ·{" "}
        {result.reviewerStatus.replaceAll("_", " ")}
      </p>
      {result.failureCode ? <p className="failure-code">{result.failureCode}</p> : null}
      {result.feedbackItems.map((item, index) => (
        <p className="feedback__copy" key={`${item.elementId ?? "policy"}-${index}`}>
          {item.reason}
        </p>
      ))}
      {result.scoringPerformed ? (
        <div className="findings-grid">
          <FindingList title="Satisfied" ids={result.satisfiedElementIds} tone="positive" />
          <FindingList title="Missing" ids={result.missingElementIds} tone="warning" />
          <FindingList title="Dangerous wording" ids={result.dangerousClaimIds} tone="danger" />
        </div>
      ) : null}
    </div>
  );
}

function EvidenceCard({ attempt }: { attempt: AttemptRecord }) {
  const finalResult = attempt.secondJudgement ?? attempt.firstJudgement;
  return (
    <article className="evidence-card">
      <div className="evidence-card__topline">
        <span>{finalResult.decision}</span>
        <time dateTime={attempt.updatedAt}>
          {new Date(attempt.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
      <h3>{attempt.legacyItemId}</h3>
      <p>{decisionLabel(finalResult)}</p>
      <p className={`persistence persistence--${attempt.persistenceStatus.toLowerCase()}`}>
        {persistenceLabel(attempt)}
      </p>
      <dl>
        <div>
          <dt>First</dt>
          <dd>{attempt.firstJudgement.decision}</dd>
        </div>
        <div>
          <dt>Rewrite</dt>
          <dd>{attempt.secondJudgement?.decision ?? "—"}</dd>
        </div>
      </dl>
      <button className="button button--quiet" type="button" onClick={() => downloadAttempt(attempt)}>
        Export JSON
      </button>
    </article>
  );
}

export default function App() {
  const [archive] = useState(() => new AttemptArchive(getBrowserStorage()));
  const [workflow, setWorkflow] = useState<WorkflowState>(() => createWorkflowState());
  const [attempts, setAttempts] = useState<readonly AttemptRecord[]>(() => archive.list());
  const [firstAnswer, setFirstAnswer] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [formError, setFormError] = useState("");

  const dependencies: WorkflowDependencies = {
    activeStandard: activeDynamicEquilibriumStandard,
    legacyItem: legacyDynamicEquilibriumDefinition,
    curriculum,
    now: () => new Date().toISOString(),
    createId,
  };

  function persistWorkflow(nextWorkflow: WorkflowState): void {
    if (!nextWorkflow.attempt) {
      setWorkflow(nextWorkflow);
      return;
    }
    const saved = archive.save(nextWorkflow.attempt);
    if (!saved.attempt) {
      setWorkflow(withPersistenceStatus(nextWorkflow, "FAILED"));
      return;
    }
    setWorkflow({ ...nextWorkflow, attempt: saved.attempt });
    setAttempts(archive.list());
  }

  function handleFirstSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError("");
    try {
      persistWorkflow(submitFirstAnswer(workflow, firstAnswer, dependencies));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to judge this answer.");
    }
  }

  function handleRewriteSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError("");
    try {
      persistWorkflow(submitRewrite(workflow, rewrite, dependencies));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to judge this rewrite.");
    }
  }

  function handleReveal(): void {
    persistWorkflow(revealReference(workflow, () => new Date().toISOString()));
  }

  function handleNewAttempt(): void {
    setWorkflow(createWorkflowState());
    setFirstAnswer("");
    setRewrite("");
    setFormError("");
  }

  const node = activeDynamicEquilibriumStandard.node;
  const currentAttempt = workflow.attempt;
  const currentPersistenceWarning = currentAttempt ? persistenceWarning(currentAttempt) : null;

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="kicker">9701 · Standards Trainer prototype</p>
          <h1>Dynamic equilibrium, written to the boundary.</h1>
          <p className="hero__summary">
            Produce an answer, inspect the exact missing concept, then repair it. Every judgement remains tied to the
            frozen draft rubric and legacy content identity.
          </p>
        </div>
        <div className="hero__status" aria-label="Content authority">
          <span>AI draft</span>
          <strong>Not expert reviewed</strong>
          <small>Internal demo decisions only</small>
        </div>
      </header>

      <main className="trainer-grid">
        <aside className="panel standard-panel" aria-labelledby="standard-title">
          <div className="panel__heading">
            <span className="step-number">01</span>
            <div>
              <p className="panel__eyebrow">Standard</p>
              <h2 id="standard-title">{node.concept}</h2>
            </div>
          </div>
          <div className="metadata-row">
            <span>{node.board}</span>
            <span>{node.syllabusCode}</span>
            <span>{node.syllabusCycle}</span>
          </div>
          <p className="standard-summary">{node.requirementSummary}</p>
          <section>
            <h3 className="section-label">Current draft elements</h3>
            <ol className="rubric-list">
              {node.requiredElements.map((element) => (
                <li key={element.id}>{element.description}</li>
              ))}
            </ol>
          </section>
          <section className="authority-note" role="note">
            <strong>Evidence boundary</strong>
            <p>
              The operational rubric is AI_DRAFT. The linked legacy answer is preserved, not silently declared wrong.
            </p>
          </section>
          <dl className="version-list">
            <div>
              <dt>Legacy item</dt>
              <dd>{legacyDynamicEquilibriumDefinition.id}</dd>
            </div>
            <div>
              <dt>Rubric</dt>
              <dd>{node.rubricVersion}</dd>
            </div>
          </dl>
        </aside>

        <section className="panel workspace-panel" aria-labelledby="workspace-title">
          <div className="panel__heading">
            <span className="step-number">02</span>
            <div>
              <p className="panel__eyebrow">Active training</p>
              <h2 id="workspace-title">Answer, inspect, rewrite</h2>
            </div>
          </div>

          <section className="prompt-card">
            <p>Current task</p>
            <h3>{node.prompt}</h3>
          </section>

          {workflow.phase === "ANSWERING" ? (
            <form onSubmit={handleFirstSubmit}>
              <label className="answer-field" htmlFor="first-answer">
                <span>Your first answer</span>
                <textarea
                  id="first-answer"
                  value={firstAnswer}
                  onChange={(event) => setFirstAnswer(event.target.value)}
                  rows={7}
                  autoComplete="off"
                  placeholder="Write the definition in your own words."
                />
              </label>
              <button className="button button--primary" type="submit" disabled={!firstAnswer.trim()}>
                Check first answer
              </button>
            </form>
          ) : null}

          {currentAttempt ? (
            <section className="feedback-region" aria-live="polite" aria-atomic="true">
              <Feedback result={currentAttempt.secondJudgement ?? currentAttempt.firstJudgement} />
              {currentPersistenceWarning ? (
                <p className="storage-warning" role="status">
                  {currentPersistenceWarning}
                </p>
              ) : null}
            </section>
          ) : null}

          {workflow.phase === "REWRITING" ? (
            <form className="rewrite-form" onSubmit={handleRewriteSubmit}>
              <label className="answer-field" htmlFor="rewrite-answer">
                <span>Your required rewrite</span>
                <textarea
                  id="rewrite-answer"
                  value={rewrite}
                  onChange={(event) => setRewrite(event.target.value)}
                  rows={7}
                  autoComplete="off"
                  placeholder="Repair the missing or unsafe concept without copying one exact sentence."
                />
              </label>
              <button className="button button--primary" type="submit" disabled={!rewrite.trim()}>
                Check rewrite
              </button>
            </form>
          ) : null}

          {currentAttempt && !currentAttempt.referenceRevealedAt && workflow.phase !== "HELD" ? (
            <button className="button button--secondary" type="button" onClick={handleReveal}>
              Reveal draft reference
            </button>
          ) : null}

          {currentAttempt?.referenceRevealedAt ? (
            <section className="reference-answer">
              <p>Draft reference · reveal does not create a pass</p>
              <blockquote>{node.referenceAnswer}</blockquote>
            </section>
          ) : null}

          {workflow.phase === "COMPLETE" || workflow.phase === "HELD" ? (
            <button className="button button--secondary" type="button" onClick={handleNewAttempt}>
              Start a new attempt
            </button>
          ) : null}

          {formError ? <p className="form-error">{formError}</p> : null}
        </section>

        <aside className="panel evidence-panel" aria-labelledby="evidence-title">
          <div className="panel__heading">
            <span className="step-number">03</span>
            <div>
              <p className="panel__eyebrow">Evidence</p>
              <h2 id="evidence-title">Attempt archive</h2>
            </div>
          </div>
          <p className="evidence-intro">
            First and second judgements stay separate, with content, rubric and authority versions attached.
          </p>
          <div className="evidence-list">
            {attempts.length > 0 ? (
              attempts.map((attempt) => <EvidenceCard attempt={attempt} key={attempt.attemptId} />)
            ) : (
              <div className="empty-state">
                <strong>No attempt yet</strong>
                <p>Your first submitted answer will appear here with an honest persistence status.</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
