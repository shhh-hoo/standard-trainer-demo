import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ComponentInspector from "../src/ComponentInspector";

describe("trainer component inspector", () => {
  it("inspects manifest, coverage examples, and explicit mock invocation envelopes", async () => {
    const user = userEvent.setup();
    render(<ComponentInspector />);

    expect(
      screen.getByRole("heading", { name: "Chemistry Calculation Trainer" }),
    ).toBeVisible();
    expect(screen.getByText("Component inspector · Not a learner app")).toBeVisible();
    expect(screen.getByText("Operational inputs")).toBeVisible();
    expect(screen.getByText("Developer fixtures")).toBeVisible();
    expect(screen.getByText("Operational component invocation")).toBeVisible();
    expect(screen.getByText("Developer fixture runner")).toBeVisible();
    expect(screen.getByText("EXACT_MATCH")).toBeVisible();
    expect(screen.getByText("INVOKE_COMPONENT")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Partial match" }));
    expect(screen.getByText("PARTIAL_MATCH")).toBeVisible();
    expect(screen.getByText("REQUIRE_INTERPRETER")).toBeVisible();
    expect(screen.getByText("multimodal-interpreter")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "No match" }));
    expect(screen.getByText("UNSUPPORTED")).toBeVisible();
    expect(screen.getByText("DO_NOT_INVOKE")).toBeVisible();
    expect(screen.getByText("supported-problem-definition")).toBeVisible();
    expect(screen.queryByText("RECORD_CAPABILITY_GAP")).not.toBeInTheDocument();
    expect(screen.queryByText("USE_TEMPORARY_SUPPORT")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Mock scenario"), "INVERTED_FORMULA");
    await user.click(screen.getByRole("button", { name: "Run developer fixture" }));
    expect(screen.getByText("COMPLETED")).toBeVisible();
    expect(screen.getByText("STUDENT_ERROR")).toBeVisible();
    expect(screen.getByText("INVERTED_RELATION")).toBeVisible();
    expect(screen.getByText("TYPED_WORKING_MOCK")).toBeVisible();

    expect(screen.getByRole("link", { name: "Open published runtime" })).toHaveAttribute(
      "href",
      "?",
    );
    expect(screen.queryByText(/OCR is enabled/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Foundry orchestrator decides fallback and gap handling/i),
    ).toBeVisible();
  });
});
