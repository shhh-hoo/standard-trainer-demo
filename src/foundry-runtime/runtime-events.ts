export type RuntimeDemoEventType = "RUNTIME_COMPONENT_SELECTED" | "RUNTIME_DIAGNOSIS_COMPLETED";

export interface RuntimeDemoEvent {
  readonly protocolVersion: "1.0.0";
  readonly eventId: string;
  readonly sessionId: string;
  readonly type: RuntimeDemoEventType;
  readonly occurredAt: string;
  readonly actor: "TRAINER";
  readonly payload: Readonly<Record<string, unknown>>;
}

interface EventTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

interface RuntimeEventOptions {
  readonly embedded: boolean;
  readonly hasParent: boolean;
  readonly targetOrigin: string | undefined;
  readonly target: EventTarget;
}

export function emitRuntimeDemoEvent(
  type: RuntimeDemoEventType,
  payload: Readonly<Record<string, unknown>>,
  options: RuntimeEventOptions,
): RuntimeDemoEvent | null {
  if (!options.embedded || !options.hasParent || !options.targetOrigin) return null;
  const event: RuntimeDemoEvent = {
    protocolVersion: "1.0.0",
    eventId: `trainer-event-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    sessionId: "learning-foundry-local-demo",
    type,
    occurredAt: new Date().toISOString(),
    actor: "TRAINER",
    payload,
  };
  options.target.postMessage({ source: "standard-trainer-product", event }, options.targetOrigin);
  return event;
}
