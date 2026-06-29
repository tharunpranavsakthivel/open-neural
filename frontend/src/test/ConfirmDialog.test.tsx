import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../components/ConfirmDialog";

describe("ConfirmDialog Component Tests", () => {
  it("should render and call onConfirm when Confirm is clicked, and not call onCancel", async () => {
    const onConfirmMock = vi.fn();
    const onCancelMock = vi.fn();

    render(
      <ConfirmDialog
        title="Delete Item"
        description="Are you sure you want to delete this?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
        confirmText="Confirm"
        cancelText="Cancel"
      />,
    );

    // Verify title and description render
    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this?"),
    ).toBeInTheDocument();

    // Click Confirm button
    const confirmButton = screen.getByRole("button", {
      name: "Confirm this action",
    });
    await userEvent.click(confirmButton);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    expect(onCancelMock).not.toHaveBeenCalled();
  });

  it("should render and call onCancel when Cancel is clicked, and not call onConfirm", async () => {
    const onConfirmMock = vi.fn();
    const onCancelMock = vi.fn();

    render(
      <ConfirmDialog
        title="Delete Item"
        description="Are you sure you want to delete this?"
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
        confirmText="Confirm"
        cancelText="Cancel"
      />,
    );

    // Click Cancel button
    const cancelButton = screen.getByRole("button", {
      name: "Cancel and close dialog",
    });
    await userEvent.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalledTimes(1);
    expect(onConfirmMock).not.toHaveBeenCalled();
  });
});
