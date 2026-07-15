import { useState } from "react";
import { evaluatePublishedAttempt, publishedComponentRegistry, STANDARD_TRAINER_CAPABILITY, type LearnerEvidenceTrace, type NormalizedAttempt, type PublishedDiagnosticLearningComponent } from "./foundry-runtime";

function defaults(component: PublishedDiagnosticLearningComponent) {
  return { value: String(component.target.expectedValue), unit: component.target.acceptedUnits[0], significantFigures: String(component.target.significantFigures), stoichiometricRatio: "1", arithmeticWorkingValue: "", completeness: "FULL" as "FULL" | "MISSING" };
}

function defaultAttemptId(): string { return `attempt-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`; }

export default function App() {
  const components = publishedComponentRegistry.list();
  const [component, setComponent] = useState(components[0]);
  const [draft, setDraft] = useState(() => defaults(components[0]));
  const [trace, setTrace] = useState<LearnerEvidenceTrace | null>(null);

  function selectComponent(componentId: string) {
    const selected = publishedComponentRegistry.get(componentId);
    if (!selected) return;
    setComponent(selected); setDraft(defaults(selected)); setTrace(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiredNodes = component.reasoningGraph.acceptedStrategies[0].nodeRequirements.filter((item) => item.requirement === "REQUIRED").map((item) => item.nodeId);
    const attempt: NormalizedAttempt = {
      attemptId: defaultAttemptId(), componentId: component.id, componentVersion: component.version,
      strategyId: component.reasoningGraph.acceptedStrategies[0].id,
      evidencedReasoningNodeIds: draft.completeness === "FULL" ? requiredNodes : requiredNodes.slice(1),
      substitutedFacts: {},
      ...(component.target.kind === "MASS" ? { stoichiometricRatio: Number(draft.stoichiometricRatio) } : {}),
      ...(draft.arithmeticWorkingValue.trim() ? { arithmeticWorkingValue: Number(draft.arithmeticWorkingValue) } : {}),
      finalAnswer: { value: Number(draft.value), unit: draft.unit, significantFigures: Number(draft.significantFigures) },
    };
    const result = evaluatePublishedAttempt(component, attempt, { traceId: `${attempt.attemptId}:trace`, submittedAt: new Date().toISOString() });
    setTrace(result.ok ? result.trace : { traceId: "rejected", attemptId: attempt.attemptId, componentId: component.id, componentVersion: component.version, componentContentHash: component.publication.contentHash, runtimeVersion: STANDARD_TRAINER_CAPABILITY.runtimeVersion, decision: "STUDENT_ERROR", failureCode: null, firstPedagogicalError: null, evidence: result.issues.map((issue) => `${issue.code}: ${issue.message}`), submittedAt: new Date().toISOString() });
  }

  return (
    <main>
      <a className="skip-link" href="#attempt-heading">Skip to learner evidence</a>
      <header className="runtime-header">
        <div><p className="eyebrow">Standard Trainer · Downstream runtime</p><h1>Deterministic diagnosis from <em>published reasoning contracts.</em></h1><p>Choose a Foundry-published component, submit structured learner evidence, and stop at the first pedagogical error.</p></div>
        <aside><span>Runtime</span><strong>{STANDARD_TRAINER_CAPABILITY.runtimeId}@{STANDARD_TRAINER_CAPABILITY.runtimeVersion}</strong><small>KP + MASS adapters · No LLM call</small></aside>
      </header>

      <section className="component-selector" aria-labelledby="selector-heading">
        <div><p className="panel-label">Published component registry</p><h2 id="selector-heading">Select diagnostic component</h2></div>
        <div className="component-options">{components.map((item) => <button key={item.id} className={item.id === component.id ? "selected" : ""} onClick={() => selectComponent(item.id)}><span>{item.target.kind}</span><strong>{item.presentation.title}</strong><small>{item.curriculum.topic} · v{item.version}</small></button>)}</div>
      </section>

      <div className="runtime-grid">
        <aside className="contract-panel">
          <p className="panel-label">Immutable contract</p><h2>{component.presentation.reaction ?? component.presentation.title}</h2><p>{component.presentation.prompt}</p>
          <dl>{component.authoredFacts.map((fact) => <div key={fact.id}><dt>{fact.label}</dt><dd>{fact.value} {fact.unit}</dd></div>)}</dl>
          <div className="contract-meta"><span>Origin</span><strong>{component.provenance.origin}</strong><span>Hash</span><code>{component.publication.contentHash}</code><span>Schema</span><strong>{component.schemaVersion}</strong></div>
          <p className="source-note">Generated from learning-foundry-demo. This runtime cannot edit component definitions.</p>
        </aside>

        <section className="attempt-panel" aria-labelledby="attempt-heading">
          <div className="section-heading"><div><p className="panel-label">Structured learner evidence</p><h2 id="attempt-heading">Evaluate the authored route</h2></div><span>{component.reasoningGraph.pedagogicalOrder.length} required stages</span></div>
          <ol className="reasoning-route">{component.reasoningGraph.pedagogicalOrder.map((nodeId, index) => <li key={nodeId}><b>{String(index + 1).padStart(2, "0")}</b><span>{component.reasoningGraph.nodes[nodeId].label}<small>{component.reasoningGraph.nodes[nodeId].category}</small></span></li>)}</ol>
          <form onSubmit={submit}>
            <label>Evidence completeness<select value={draft.completeness} onChange={(event) => setDraft({ ...draft, completeness: event.target.value as typeof draft.completeness })}><option value="FULL">All required reasoning links</option><option value="MISSING">Omit first reasoning link</option></select></label>
            {component.target.kind === "MASS" ? <label>Mg:MgO mole ratio<input aria-label="Mg:MgO mole ratio" type="number" step="any" value={draft.stoichiometricRatio} onChange={(event) => setDraft({ ...draft, stoichiometricRatio: event.target.value })} /></label> : null}
            <label>Arithmetic working value (optional)<input aria-label="Arithmetic working value" type="number" step="any" value={draft.arithmeticWorkingValue} onChange={(event) => setDraft({ ...draft, arithmeticWorkingValue: event.target.value })} /></label>
            <label>Final value<input aria-label="Final value" type="number" step="any" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></label>
            <label>Unit<input aria-label="Unit" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label>
            <label>Significant figures<input aria-label="Significant figures" type="number" min="1" value={draft.significantFigures} onChange={(event) => setDraft({ ...draft, significantFigures: event.target.value })} /></label>
            <button className="button button--primary" type="submit">Diagnose learner evidence</button>
          </form>
        </section>

        <aside className="evidence-panel" aria-labelledby="evidence-heading">
          <p className="panel-label">Learner evidence trace</p><h2 id="evidence-heading">First pedagogical error</h2>
          {trace ? <div className={`runtime-result runtime-result--${trace.decision.toLowerCase()}`} aria-live="polite"><span>{trace.decision}</span><h3>{trace.decision === "SOLVED" ? "Reasoning contract satisfied" : trace.firstPedagogicalError ?? "Runtime boundary rejected"}</h3><code>{trace.failureCode ?? "SOLVED"}</code>{trace.evidence.map((item) => <p key={item}>{item}</p>)}<dl><div><dt>Component</dt><dd>{trace.componentId}@{trace.componentVersion}</dd></div><div><dt>Runtime</dt><dd>{trace.runtimeVersion}</dd></div></dl></div> : <p className="empty-state">Submit evidence to create a version-pinned deterministic trace.</p>}
          <div className="assurance"><strong>Bounded assurance</strong><p>Arithmetic, authored facts, target, unit, precision and adapter compatibility are deterministic. Arbitrary prose and unsupported target kinds fail closed.</p></div>
        </aside>
      </div>
    </main>
  );
}

