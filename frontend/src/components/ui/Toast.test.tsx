/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Toast, { type ToastData } from "./Toast";

function makeToast(overrides: Partial<ToastData> = {}): ToastData {
  return {
    id: "toast-1",
    variant: "pending",
    message: "Submitting transaction…",
    ...overrides,
  };
}

describe("Toast", () => {
  it("renders a pending toast with a polite live region", () => {
    render(<Toast toast={makeToast()} onDismiss={jest.fn()} />);

    const el = screen.getByTestId("toast-pending");
    expect(el).toHaveAttribute("role", "status");
    expect(el).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Submitting transaction…")).toBeInTheDocument();
    expect(screen.getByTestId("toast-icon-pending")).toBeInTheDocument();
  });

  it("renders a success toast with a polite live region", () => {
    render(
      <Toast
        toast={makeToast({ variant: "success", message: "Deposit confirmed" })}
        onDismiss={jest.fn()}
      />,
    );

    const el = screen.getByTestId("toast-success");
    expect(el).toHaveAttribute("role", "status");
    expect(el).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Deposit confirmed")).toBeInTheDocument();
    expect(screen.getByTestId("toast-icon-success")).toBeInTheDocument();
  });

  it("renders an error toast with an assertive live region", () => {
    render(
      <Toast
        toast={makeToast({ variant: "error", message: "Transaction failed" })}
        onDismiss={jest.fn()}
      />,
    );

    const el = screen.getByTestId("toast-error");
    expect(el).toHaveAttribute("role", "alert");
    expect(el).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("Transaction failed")).toBeInTheDocument();
    expect(screen.getByTestId("toast-icon-error")).toBeInTheDocument();
  });

  it("renders an optional transaction link when txUrl is provided", () => {
    render(
      <Toast
        toast={makeToast({
          variant: "success",
          txUrl: "https://stellar.expert/explorer/testnet/tx/abc123",
        })}
        onDismiss={jest.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: /view transaction/i });
    expect(link).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("supports a custom transaction link label", () => {
    render(
      <Toast
        toast={makeToast({
          variant: "success",
          txUrl: "https://stellar.expert/tx/abc",
          txLabel: "See on explorer",
        })}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: /see on explorer/i })).toBeInTheDocument();
  });

  it("omits the transaction link when txUrl is absent", () => {
    render(<Toast toast={makeToast()} onDismiss={jest.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onDismiss with the toast id when the dismiss button is clicked", () => {
    const onDismiss = jest.fn();
    render(<Toast toast={makeToast({ id: "toast-42" })} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));

    expect(onDismiss).toHaveBeenCalledWith("toast-42");
  });
});
