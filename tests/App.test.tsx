import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("calculation path workbench", () => {
  it("renders the single curated problem as seven structured path steps", () => {
    render(<App storage={null} />);

    expect(screen.getByRole("heading", { name: "Kp from equilibrium moles" })).toBeVisible();
    expect(screen.getByText("N₂O₄(g) ⇌ 2NO₂(g)")).toBeVisible();
    expect(screen.getAllByTestId("path-step")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Check calculation path" })).toBeEnabled();
    expect(screen.getByText("Deterministic tools only · No LLM call")).toBeVisible();
    expect(screen.getByText("Calculation-path engine · Core proof")).toBeVisible();
    expect(screen.queryByText(/PR 1/)).not.toBeInTheDocument();
  });

  it("submits the structured canonical path and shows an exportable trace", async () => {
    const user = userEvent.setup();
    render(
      <App
        storage={null}
        now={() => "2026-07-14T04:00:00.000Z"}
        createAttemptId={() => "attempt-ui-valid"}
      />,
    );

    const numericInputs = screen.getAllByLabelText("Numeric value");
    for (const [input, value] of numericInputs.map((input, index) => [
      input,
      ["1", "0.4", "0.6", "200", "300", "450"][index],
    ] as const)) {
      await user.type(input, value);
    }
    const unitInputs = screen.getAllByLabelText("Unit");
    for (const [input, value] of unitInputs.map((input, index) => [
      input,
      ["mol", "kPa", "kPa", "kPa"][index],
    ] as const)) {
      await user.type(input, value);
    }
    await user.type(screen.getByLabelText("Expression"), "p(NO2)^2/p(N2O4)");
    await user.type(screen.getByLabelText("Significant figures"), "3");
    await user.click(screen.getByRole("button", { name: "Check calculation path" }));

    expect(screen.getByRole("heading", { name: "Calculation path verified" })).toBeVisible();
    expect(screen.getByText("Current tab only — export before leaving")).toBeVisible();
    expect(screen.getByRole("button", { name: "Export evidence JSON" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Evidence archive" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /rewrite/i })).not.toBeInTheDocument();
  });

  it("announces the first invalid structured step without opening a rewrite loop", async () => {
    const user = userEvent.setup();
    render(<App storage={null} />);

    await user.type(screen.getAllByLabelText("Numeric value")[0], "0.9");
    await user.type(screen.getAllByLabelText("Unit")[0], "mol");
    await user.click(screen.getByRole("button", { name: "Check calculation path" }));

    expect(screen.getByText(/First invalid step:/)).toHaveTextContent(
      "First invalid step: Total equilibrium moles",
    );
    expect(screen.getByText("NUMERIC_MISMATCH")).toBeVisible();
    expect(screen.queryByRole("button", { name: /rewrite/i })).not.toBeInTheDocument();
  });
});
