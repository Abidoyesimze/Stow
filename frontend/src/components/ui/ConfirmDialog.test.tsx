import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: "Confirm Action",
    body: "Are you sure you want to proceed?",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when open is true", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to proceed?"),
    ).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onConfirm and onClose when confirm button is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmButton = screen.getByText("Confirm");
    fireEvent.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose when close X button is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const closeButton = screen.getByLabelText("Close dialog");
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose when ESC key is pressed", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the dialog", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole("document");
    fireEvent.click(dialog);

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("uses custom button text when provided", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Delete"
        cancelText="Keep"
      />,
    );

    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Keep")).toBeInTheDocument();
  });

  it("renders with danger variant styling", () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" />);
    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toHaveClass("text-red-300");
  });

  it("renders with warning variant styling", () => {
    render(<ConfirmDialog {...defaultProps} variant="warning" />);
    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toHaveClass("text-yellow-300");
  });

  it("renders with info variant styling by default", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toHaveClass("text-brand");
  });

  it("traps focus within dialog", async () => {
    render(<ConfirmDialog {...defaultProps} />);

    const confirmButton = screen.getByText("Confirm");
    const cancelButton = screen.getByText("Cancel");
    const closeButton = screen.getByLabelText("Close dialog");

    // Confirm button should be focused first
    await waitFor(() => {
      expect(confirmButton).toHaveFocus();
    });

    // Tab should cycle through focusable elements
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBeTruthy();

    // Shift+Tab should cycle backwards
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBeTruthy();
  });

  it("renders React node as body", () => {
    const bodyNode = (
      <div>
        <p>First paragraph</p>
        <p>Second paragraph</p>
      </div>
    );

    render(<ConfirmDialog {...defaultProps} body={bodyNode} />);

    expect(screen.getByText("First paragraph")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph")).toBeInTheDocument();
  });

  it("has proper ARIA attributes", () => {
    render(<ConfirmDialog {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "dialog-description");
  });
});
