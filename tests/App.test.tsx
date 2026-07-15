import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("Foundry-published calculation runtime", () => {
  it("lists both bounded diagnostic components from the immutable registry", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Select diagnostic component" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Kp from equilibrium amounts/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Stoichiometric product mass/ })).toBeVisible();
    expect(screen.getByText("KP + MASS adapters · No LLM call")).toBeVisible();
    expect(screen.getByText("Generated from learning-foundry-demo. This runtime cannot edit component definitions.")).toBeVisible();
  });

  it("solves the published mass component with a complete deterministic attempt", async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole("button", { name: /Stoichiometric product mass/ }));
    expect(screen.getByText("2Mg + O₂ → 2MgO")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Diagnose learner evidence" }));
    expect(screen.getByText("Reasoning contract satisfied")).toBeVisible();
    expect(screen.getByText("SOLVED", { selector: "code" })).toBeVisible();
  });

  it("reports the wrong mole ratio as the first pedagogical error", async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole("button", { name: /Stoichiometric product mass/ }));
    await user.clear(screen.getByLabelText("Mg:MgO mole ratio"));
    await user.type(screen.getByLabelText("Mg:MgO mole ratio"), "0.5");
    await user.click(screen.getByRole("button", { name: "Diagnose learner evidence" }));
    expect(screen.getByText("WRONG_STOICHIOMETRIC_RATIO")).toBeVisible();
    expect(screen.getByRole("heading", { name: "FORMULA" })).toBeVisible();
  });
});

