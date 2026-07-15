import { useState } from "react";
import {
  chemistryCalculationTrainer,
  invokeChemistryCalculationTrainerDeveloperScenario,
  SUPPORTED_PROBLEM_DEFINITION,
} from "./component/chemistryCalculationTrainer";
import type {
  ComponentResultEnvelope,
  LearningRequestDescriptor,
} from "./component/types";
import {
  typedWorkingScenarioDisplay,
  type TypedWorkingMockScenario,
} from "./mocks/v2/typedWorkingScenarios";

const coverageExamples = Object.freeze({
  exact: Object.freeze({
    label: "Exact match",
    description: "Canonical problem with an already-normalized attempt.",
    request: Object.freeze({
      task: "diagnose-calculation-attempt",
      problemDefinition: SUPPORTED_PROBLEM_DEFINITION,
      inputKind: "normalized-attempt",
    }),
  }),
  partial: Object.freeze({
    label: "Partial match",
    description: "Canonical problem supplied as handwriting; an interpreter is still missing.",
    request: Object.freeze({
      task: "diagnose-calculation-attempt",
      problemDefinition: SUPPORTED_PROBLEM_DEFINITION,
      inputKind: "handwriting-image",
    }),
  }),
  unsupported: Object.freeze({
    label: "No match",
    description: "A Buffer pH request outside this component's authored boundary.",
    request: Object.freeze({
      task: "diagnose-calculation-attempt",
      problemDefinition: "BUFFER_PH_CALCULATION@1.0.0",
      inputKind: "natural-language-working",
    }),
  }),
} satisfies Readonly<
  Record<
    string,
    {
      readonly label: string;
      readonly description: string;
      readonly request: LearningRequestDescriptor;
    }
  >
>);

const mockScenarios = Object.keys(
  typedWorkingScenarioDisplay,
) as readonly TypedWorkingMockScenario[];

type CoverageExampleId = keyof typeof coverageExamples;

function CapabilityList({
  label,
  values,
}: {
  readonly label: string;
  readonly values: readonly string[];
}) {
  return (
    <div className="inspector-list-block">
      <h3>{label}</h3>
      {values.length > 0 ? (
        <ul className="token-list">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="inspector-empty">None</p>
      )}
    </div>
  );
}

function InvocationResult({
  envelope,
}: {
  readonly envelope: ComponentResultEnvelope;
}) {
  return (
    <section className="invocation-result" aria-live="polite">
      <div className="result-strip">
        <span>Status</span>
        <strong>{envelope.status}</strong>
      </div>
      {envelope.result ? (
        <>
          <dl className="result-facts">
            <div>
              <dt>Decision</dt>
              <dd>{envelope.result.decision}</dd>
            </div>
            <div>
              <dt>First error</dt>
              <dd>{envelope.result.failureCode ?? "NONE"}</dd>
            </div>
            <div>
              <dt>Interpreter</dt>
              <dd>{envelope.result.interpreter.kind}</dd>
            </div>
            <div>
              <dt>Support outcome</dt>
              <dd>{envelope.result.attemptSupportOutcome}</dd>
            </div>
          </dl>
          <details>
            <summary>Inspect evidence trace</summary>
            <pre>{JSON.stringify(envelope.result, null, 2)}</pre>
          </details>
        </>
      ) : (
        <CapabilityList
          label="Invocation issues"
          values={(envelope.issues ?? []).map(({ code }) => code)}
        />
      )}
    </section>
  );
}

export default function ComponentInspector() {
  const [exampleId, setExampleId] = useState<CoverageExampleId>("exact");
  const [scenario, setScenario] = useState<TypedWorkingMockScenario>("COMPRESSED_CORRECT");
  const [envelope, setEnvelope] = useState<ComponentResultEnvelope | null>(null);
  const manifest = chemistryCalculationTrainer.manifest;
  const example = coverageExamples[exampleId];
  const fit = chemistryCalculationTrainer.preflight(example.request);

  function invokeMock(): void {
    const submittedAt = "2026-07-15T10:00:00.000Z";
    setEnvelope(
      invokeChemistryCalculationTrainerDeveloperScenario({
        input: {
          scenario,
          attemptId: `inspector-${scenario.toLowerCase()}`,
          submittedAt,
        },
        context: {
          traceId: `inspector-trace-${scenario.toLowerCase()}`,
          submittedAt,
          interpreter: {
            kind: "TYPED_WORKING_MOCK",
            adapterVersion: "inspector-request-v1",
          },
        },
      }),
    );
  }

  return (
    <main className="inspector-shell">
      <header className="inspector-hero">
        <div>
          <p className="eyebrow">Component inspector · Not a learner app</p>
          <h1>Chemistry Calculation Trainer</h1>
          <p>
            A bounded deterministic component that diagnoses one authored CAIE 9701 Kp
            calculation after input has been normalized.
          </p>
        </div>
        <div className="inspector-actions">
          <span className="component-version">{manifest.componentVersion}</span>
          <a className="button button--secondary" href="?view=legacy">
            Open legacy V0.1 proof
          </a>
        </div>
      </header>

      <section className="inspector-layout" aria-label="Component boundary inspector">
        <article className="inspector-card manifest-card">
          <p className="panel-label">Component manifest</p>
          <h2>{manifest.componentId}</h2>
          <dl className="manifest-facts">
            <div>
              <dt>Type</dt>
              <dd>{manifest.componentType}</dd>
            </div>
            <div>
              <dt>Curriculum</dt>
              <dd>{manifest.domain.curriculum}</dd>
            </div>
            <div>
              <dt>Topic</dt>
              <dd>{manifest.domain.topic}</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>{manifest.guarantees.problemCoverage}</dd>
            </div>
          </dl>
          <CapabilityList
            label="Operational inputs"
            values={manifest.operationalInputs}
          />
          <CapabilityList label="Developer fixtures" values={manifest.developerFixtures} />
          <CapabilityList label="Explicitly unsupported" values={manifest.unsupported} />
        </article>

        <article className="inspector-card preflight-card">
          <p className="panel-label">Capability preflight</p>
          <h2>Coverage decision</h2>
          <div className="example-tabs" role="group" aria-label="Coverage examples">
            {(
              Object.entries(coverageExamples) as readonly [
                CoverageExampleId,
                (typeof coverageExamples)[CoverageExampleId],
              ][]
            ).map(([id, item]) => (
                <button
                  key={id}
                  aria-pressed={exampleId === id}
                  className="example-tab"
                  type="button"
                  onClick={() => setExampleId(id)}
                >
                  {item.label}
                </button>
              ))}
          </div>
          <p className="example-description">{example.description}</p>
          <div className={`coverage-badge coverage-badge--${fit.coverage.toLowerCase()}`}>
            <span>Coverage</span>
            <strong>{fit.coverage}</strong>
            <small>
              Task {String(fit.matchDimensions.task)} · Problem{" "}
              {String(fit.matchDimensions.problemDefinition)} · Input ready{" "}
              {String(fit.matchDimensions.inputReady)}
            </small>
          </div>
          <div className="action-callout">
            <span>Recommended action</span>
            <strong>{fit.recommendedAction}</strong>
          </div>
          <CapabilityList label="Matched capabilities" values={fit.matchedCapabilities} />
          <CapabilityList label="Missing capabilities" values={fit.missingCapabilities} />
          <CapabilityList label="Limitations" values={fit.limitations} />
          <div className="operational-boundary">
            <h3>Operational component invocation</h3>
            <p>
              Only exact operational inputs may call the deterministic diagnosis core.
            </p>
          </div>
        </article>

        <article className="inspector-card invocation-card">
          <p className="panel-label">Developer fixture runner</p>
          <h2>Run an authored fixture</h2>
          <p className="example-description">
            Developer only. These authored fixtures are not learner inputs or
            registry-discoverable capabilities, and they do not parse learner text.
          </p>
          <label className="scenario-field">
            Mock scenario
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as TypedWorkingMockScenario)}
            >
              {mockScenarios.map((mockScenario) => (
                <option key={mockScenario} value={mockScenario}>
                  {mockScenario}
                </option>
              ))}
            </select>
          </label>
          <blockquote>{typedWorkingScenarioDisplay[scenario]}</blockquote>
          <button className="button button--primary" type="button" onClick={invokeMock}>
            Run developer fixture
          </button>
          {envelope ? (
            <InvocationResult envelope={envelope} />
          ) : (
            <p className="inspector-empty invocation-empty">
              Run a developer fixture to inspect the structured result envelope.
            </p>
          )}
        </article>
      </section>

      <footer className="inspector-footer">
        <strong>Boundary:</strong> Registry discovery, Chat interpretation, temporary support,
        capability-gap persistence, Library, and Schedule belong to Learning Foundry—not this
        component. The Foundry orchestrator decides fallback and gap handling outside this
        component.
      </footer>
    </main>
  );
}
