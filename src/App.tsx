import { useEffect, useMemo, useState } from "react";
import {
  runLearnerDiagnosis,
  LocalDemoRegistryProvider,
  MergedComponentRegistry,
  publishedComponentRegistry,
  selectSupportHint,
  STANDARD_TRAINER_CAPABILITY,
  StaticBundledRegistryProvider,
  loadMergedRegistry,
  emitRuntimeDemoEvent,
  type LearnerEvidenceTrace,
  type NormalizedAttempt,
  type PublishedDiagnosticLearningComponent,
  type RegistrySource,
} from "./foundry-runtime";

function defaults(component: PublishedDiagnosticLearningComponent) {
  return { value: String(component.target.expectedValue), unit: component.target.acceptedUnits[0], significantFigures: String(component.target.significantFigures), stoichiometricRatio: "1", arithmeticWorkingValue: "", completeness: "FULL" as "FULL" | "MISSING" };
}

function defaultAttemptId(): string { return `attempt-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`; }
const embedded = new URLSearchParams(window.location.search).get("embedded") === "1";

function emitRuntimeEvent(type: "RUNTIME_COMPONENT_SELECTED" | "RUNTIME_DIAGNOSIS_COMPLETED", payload: Readonly<Record<string, unknown>>): void {
  const allowedParentOrigin = import.meta.env.VITE_FOUNDRY_ORIGIN as string | undefined;
  emitRuntimeDemoEvent(type, payload, {
    embedded,
    hasParent: window.parent !== window,
    targetOrigin: allowedParentOrigin,
    target: { postMessage: (message, targetOrigin) => window.parent.postMessage(message, targetOrigin) },
  });
}

function initialComponent(): PublishedDiagnosticLearningComponent {
  const requested = new URLSearchParams(window.location.search).get("component");
  const requestedComponent = requested ? publishedComponentRegistry.get(requested) : null;
  return (requestedComponent?.target.kind === "KP" ? null : requestedComponent) ?? publishedComponentRegistry.get("stoichiometric-product-mass")!;
}

export default function App() {
  const [registry, setRegistry] = useState<MergedComponentRegistry | null>(null);
  const [registryStatus, setRegistryStatus] = useState("Static bundled registry");
  const [component, setComponent] = useState(initialComponent);
  const [draft, setDraft] = useState(() => defaults(initialComponent()));
  const [trace, setTrace] = useState<LearnerEvidenceTrace | null>(null);
  const components = useMemo(() => (registry?.list() ?? publishedComponentRegistry.list()).filter((item) => item.target.kind !== "KP"), [registry]);
  const source: RegistrySource = registry?.sourceOf(component.id, component.version) ?? "STATIC_BUNDLED_REGISTRY";
  const support = trace ? selectSupportHint(component, trace) : null;

  useEffect(() => {
    let cancelled = false;
    const configuredUrl = import.meta.env.VITE_DEMO_REGISTRY_URL as string | undefined;
    const providers = [new StaticBundledRegistryProvider(), ...(configuredUrl ? [new LocalDemoRegistryProvider(configuredUrl)] : [])];
    loadMergedRegistry(providers).then((loaded) => {
      if (cancelled) return;
      setRegistry(loaded);
      const selected = loaded.get(component.id) ?? loaded.get("stoichiometric-product-mass")!;
      setComponent(selected); setDraft(defaults(selected)); setTrace(null);
      const selectedSource = loaded.sourceOf(selected.id, selected.version);
      setRegistryStatus(selectedSource === "LOCAL_DEMO_REGISTRY" ? "Validated local demo registry" : "Static bundled registry");
      emitRuntimeEvent("RUNTIME_COMPONENT_SELECTED", { componentId: selected.id, version: selected.version, source: selectedSource });
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error("Dynamic registry rejected; using the static fallback.", error);
      setRegistryStatus("Static fallback · dynamic snapshots rejected");
      loadMergedRegistry([new StaticBundledRegistryProvider()]).then((loaded) => { if (!cancelled) setRegistry(loaded); });
    });
    return () => { cancelled = true; };
  }, []);

  function selectComponent(componentId: string) {
    const selected = registry?.get(componentId) ?? publishedComponentRegistry.get(componentId);
    if (!selected) return;
    setComponent(selected); setDraft(defaults(selected)); setTrace(null);
    emitRuntimeEvent("RUNTIME_COMPONENT_SELECTED", { componentId: selected.id, version: selected.version, source: registry?.sourceOf(selected.id, selected.version) ?? "STATIC_BUNDLED_REGISTRY" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiredNodes = component.reasoningGraph.acceptedStrategies[0]!.nodeRequirements.filter((item) => item.requirement === "REQUIRED").map((item) => item.nodeId);
    const attempt: NormalizedAttempt = {
      attemptId: defaultAttemptId(), componentId: component.id, componentVersion: component.version,
      strategyId: component.reasoningGraph.acceptedStrategies[0]!.id,
      evidencedReasoningNodeIds: draft.completeness === "FULL" ? requiredNodes : requiredNodes.slice(1), substitutedFacts: {},
      ...(component.target.kind === "MASS" ? { stoichiometricRatio: Number(draft.stoichiometricRatio) } : {}),
      ...(draft.arithmeticWorkingValue.trim() ? { arithmeticWorkingValue: Number(draft.arithmeticWorkingValue) } : {}),
      finalAnswer: { value: Number(draft.value), unit: draft.unit, significantFigures: Number(draft.significantFigures) },
    };
    const activeRegistry = registry ?? publishedComponentRegistry;
    let nextTrace: LearnerEvidenceTrace;
    try {
      const result = await runLearnerDiagnosis({ componentId: component.id, componentVersion: component.version, problemContext: { prompt: component.presentation.prompt, reactionEquation: component.presentation.reaction ?? component.presentation.title, givenValues: component.authoredFacts.filter((fact): fact is typeof fact & { value: number } => typeof fact.value === "number").map((fact) => ({ label: fact.label, value: fact.value, unit: fact.unit ?? "1" })), targetQuantity: component.presentation.title, answerRequirement: `${component.target.significantFigures} significant figures` }, attempt }, { registry: activeRegistry });
      nextTrace = { traceId: result.traceId, attemptId: attempt.attemptId, componentId: result.componentId, componentVersion: result.componentVersion, componentContentHash: component.publication.contentHash, runtimeVersion: STANDARD_TRAINER_CAPABILITY.runtimeVersion, decision: result.diagnosis.decision, failureCode: result.diagnosis.failureCode, firstPedagogicalError: result.diagnosis.firstPedagogicalIssue, evidence: result.diagnosis.evidence, submittedAt: new Date().toISOString() };
    } catch (error) {
      nextTrace = { traceId: "rejected", attemptId: attempt.attemptId, componentId: component.id, componentVersion: component.version, componentContentHash: component.publication.contentHash, runtimeVersion: STANDARD_TRAINER_CAPABILITY.runtimeVersion, decision: "STUDENT_ERROR", failureCode: null, firstPedagogicalError: null, evidence: [error instanceof Error ? error.message : String(error)], submittedAt: new Date().toISOString() };
    }
    setTrace(nextTrace);
    emitRuntimeEvent("RUNTIME_DIAGNOSIS_COMPLETED", { componentId: component.id, version: component.version, decision: nextTrace.decision, failureCode: nextTrace.failureCode, firstPedagogicalError: nextTrace.firstPedagogicalError, supportHint: selectSupportHint(component, nextTrace)?.text ?? null });
  }

  return <main className={embedded ? "embedded-runtime" : ""}>
    <a className="skip-link" href="#attempt-heading">Skip to learner evidence</a>
    <header className="runtime-header"><div><p className="eyebrow">Standard Trainer · Downstream runtime</p><h1>Deterministic diagnosis from <em>published reasoning contracts.</em></h1><p>Choose a Foundry-published component, submit structured learner evidence, and stop at the first pedagogical error.</p></div><aside><span>Registry</span><strong>{registryStatus}</strong><small>{STANDARD_TRAINER_CAPABILITY.runtimeId}@{STANDARD_TRAINER_CAPABILITY.runtimeVersion}</small><small>MASS learner adapter · deterministic runtime</small></aside></header>
    <section className="component-selector" aria-labelledby="selector-heading"><div><p className="panel-label">Published component registry</p><h2 id="selector-heading">Select diagnostic component</h2></div><div className="component-options">{components.map((item) => <button key={item.id} className={item.id === component.id ? "selected" : ""} onClick={() => selectComponent(item.id)}><span>{item.target.kind}</span><strong>{item.presentation.title}</strong><small>{item.curriculum.topic} · v{item.version}</small></button>)}</div></section>
    <div className="runtime-grid">
      <aside className="contract-panel"><p className="panel-label">Immutable contract</p><h2>{component.presentation.reaction ?? component.presentation.title}</h2><p>{component.presentation.prompt}</p><dl>{component.authoredFacts.map((fact) => <div key={fact.id}><dt>{fact.label}</dt><dd>{fact.value} {fact.unit}</dd></div>)}</dl><div className="contract-meta"><span>Version</span><strong>{component.version}</strong><span>Registry source</span><strong>{source === "LOCAL_DEMO_REGISTRY" ? "Local demo registry" : "Static bundled registry"}</strong><span>Hash</span><code>{component.publication.contentHash}</code></div><p className="source-note">Generated from learning-foundry-demo. This runtime cannot edit component definitions.</p></aside>
      <section className="attempt-panel" aria-labelledby="attempt-heading"><div className="section-heading"><div><p className="panel-label">Structured learner evidence</p><h2 id="attempt-heading">Evaluate the authored route</h2></div><span>{component.reasoningGraph.pedagogicalOrder.length} required stages</span></div><ol className="reasoning-route">{component.reasoningGraph.pedagogicalOrder.map((nodeId, index) => <li key={nodeId}><b>{String(index + 1).padStart(2, "0")}</b><span>{component.reasoningGraph.nodes[nodeId]!.label}<small>{component.reasoningGraph.nodes[nodeId]!.category}</small></span></li>)}</ol><form onSubmit={submit}><label>Evidence completeness<select value={draft.completeness} onChange={(event) => setDraft({ ...draft, completeness: event.target.value as typeof draft.completeness })}><option value="FULL">All required reasoning links</option><option value="MISSING">Omit first reasoning link</option></select></label>{component.target.kind === "MASS" ? <label>Mg:MgO mole ratio<input aria-label="Mg:MgO mole ratio" type="number" step="any" value={draft.stoichiometricRatio} onChange={(event) => setDraft({ ...draft, stoichiometricRatio: event.target.value })} /></label> : null}<label>Arithmetic working value (optional)<input aria-label="Arithmetic working value" type="number" step="any" value={draft.arithmeticWorkingValue} onChange={(event) => setDraft({ ...draft, arithmeticWorkingValue: event.target.value })} /></label><label>Final value<input aria-label="Final value" type="number" step="any" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></label><label>Unit<input aria-label="Unit" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></label><label>Significant figures<input aria-label="Significant figures" type="number" min="1" value={draft.significantFigures} onChange={(event) => setDraft({ ...draft, significantFigures: event.target.value })} /></label><button className="button button--primary" type="submit">Diagnose learner evidence</button></form></section>
      <aside className="evidence-panel" aria-labelledby="evidence-heading"><p className="panel-label">Learner evidence trace</p><h2 id="evidence-heading">First pedagogical error</h2>{trace ? <div className={`runtime-result runtime-result--${trace.decision.toLowerCase()}`} aria-live="polite"><span>{trace.decision}</span><h3>{trace.decision === "SOLVED" ? "Reasoning contract satisfied" : trace.firstPedagogicalError ?? "Runtime boundary rejected"}</h3><code>{trace.failureCode ?? "SOLVED"}</code>{trace.evidence.map((item) => <p key={item}>{item}</p>)}{support ? <div className="recommended-support"><span>Recommended support</span><strong>{support.text}</strong></div> : null}<dl><div><dt>Component</dt><dd>{trace.componentId}@{trace.componentVersion}</dd></div><div><dt>Registry</dt><dd>{source === "LOCAL_DEMO_REGISTRY" ? "Local validated" : "Static"}</dd></div></dl></div> : <p className="empty-state">Submit evidence to create a version-pinned deterministic trace.</p>}<div className="assurance"><strong>Bounded assurance</strong><p>Diagnosis uses verified adapters. Recommended support is selected from the governed component after the first error is known.</p></div></aside>
    </div>
  </main>;
}
