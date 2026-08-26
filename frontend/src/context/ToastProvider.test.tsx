/**
 * @jest-environment jsdom
 */
import { act, render, renderHook, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { ToastProvider, useToast } from "./ToastProvider";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("ToastProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("throws when useToast is called outside a ToastProvider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within a ToastProvider",
    );
    consoleError.mockRestore();
  });

  it("renders a toast per status when shown", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast({ variant: "pending", message: "Submitting…" });
      result.current.showToast({ variant: "success", message: "Confirmed" });
      result.current.showToast({ variant: "error", message: "Failed" });
    });

    expect(screen.getByTestId("toast-pending")).toBeInTheDocument();
    expect(screen.getByTestId("toast-success")).toBeInTheDocument();
    expect(screen.getByTestId("toast-error")).toBeInTheDocument();
  });

  it("passes an optional tx link through to the rendered toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast({
        variant: "success",
        message: "Confirmed",
        txUrl: "https://stellar.expert/tx/abc",
      });
    });

    expect(screen.getByRole("link", { name: /view transaction/i })).toHaveAttribute(
      "href",
      "https://stellar.expert/tx/abc",
    );
  });

  it("auto-dismisses a success toast after its default duration", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast({ variant: "success", message: "Confirmed" });
    });
    expect(screen.getByTestId("toast-success")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("toast-success")).not.toBeInTheDocument();
  });

  it("does not auto-dismiss a pending toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast({ variant: "pending", message: "Submitting…" });
    });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("toast-pending")).toBeInTheDocument();
  });

  it("updates a pending toast to success and schedules its auto-dismiss", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.showToast({ variant: "pending", message: "Submitting…" });
    });
    expect(screen.getByTestId("toast-pending")).toBeInTheDocument();

    act(() => {
      result.current.updateToast(id, { variant: "success", message: "Confirmed" });
    });
    expect(screen.queryByTestId("toast-pending")).not.toBeInTheDocument();
    expect(screen.getByTestId("toast-success")).toHaveTextContent("Confirmed");

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("toast-success")).not.toBeInTheDocument();
  });

  it("dismisses a toast immediately via dismissToast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let id = "";
    act(() => {
      id = result.current.showToast({ variant: "error", message: "Failed" });
    });
    expect(screen.getByTestId("toast-error")).toBeInTheDocument();

    act(() => {
      result.current.dismissToast(id);
    });
    expect(screen.queryByTestId("toast-error")).not.toBeInTheDocument();
  });

  it("renders multiple concurrent toasts independently", () => {
    render(
      <ToastProvider>
        <div>content</div>
      </ToastProvider>,
    );

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });
});
