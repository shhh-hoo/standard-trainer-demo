import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { legacyDynamicEquilibriumDefinition } from "../src/fixtures/legacyItems";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("trainer interface", () => {
  it("shows draft authority and opens rewrite after a missing-element judgement", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("Not expert reviewed")).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Your first answer"),
      "The forward and reverse reactions continue at equal rates while concentrations remain constant.",
    );
    await user.click(screen.getByRole("button", { name: "Check first answer" }));

    expect(screen.getByRole("heading", { name: "Revise against the current draft rubric" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your required rewrite")).toBeInTheDocument();
    expect(screen.getByText("Saved in this browser")).toBeInTheDocument();
  });

  it("holds the exact legacy reference for review without requesting a rewrite", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Your first answer"), legacyDynamicEquilibriumDefinition.answer);
    await user.click(screen.getByRole("button", { name: "Check first answer" }));

    expect(screen.getByText("LEGACY_REFERENCE_CONFLICT")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Held for curriculum review" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your required rewrite")).not.toBeInTheDocument();
  });

  it("uses the draft-relative learner label for an internal PASS", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText("Your first answer"),
      "In a closed system, both reactions continue at the same rate and concentrations remain constant.",
    );
    await user.click(screen.getByRole("button", { name: "Check first answer" }));

    expect(screen.getByRole("heading", { name: "Meets current AI-draft rubric" })).toBeInTheDocument();
    expect(screen.queryByText(/^Correct$/i)).not.toBeInTheDocument();
  });

  it("warns honestly and keeps export available when localStorage writes fail", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText("Your first answer"),
      "In a closed system, both reactions continue at the same rate and concentrations remain constant.",
    );
    await user.click(screen.getByRole("button", { name: "Check first answer" }));

    expect(
      screen.getByText("This attempt is available only in the current tab. Export it before leaving."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeInTheDocument();
    expect(screen.queryByText("Saved in this browser")).not.toBeInTheDocument();
  });
});
