import { describe, expect, it, vi } from "vitest";
import { emitRuntimeDemoEvent } from "../src/foundry-runtime/runtime-events";

describe("embedded runtime events", () => {
  it("posts a typed event only to the configured parent origin", () => {
    const postMessage = vi.fn();
    const event = emitRuntimeDemoEvent("RUNTIME_COMPONENT_SELECTED", { version: "1.1.0" }, {
      embedded: true,
      hasParent: true,
      targetOrigin: "http://127.0.0.1:4173",
      target: { postMessage },
    });
    expect(event).toMatchObject({ protocolVersion: "1.0.0", actor: "TRAINER", type: "RUNTIME_COMPONENT_SELECTED" });
    expect(postMessage).toHaveBeenCalledWith({ source: "standard-trainer-product", event }, "http://127.0.0.1:4173");

    expect(emitRuntimeDemoEvent("RUNTIME_COMPONENT_SELECTED", {}, { embedded: true, hasParent: true, targetOrigin: undefined, target: { postMessage } })).toBeNull();
  });
});
