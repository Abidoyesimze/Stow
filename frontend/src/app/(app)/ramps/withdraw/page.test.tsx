import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WithdrawPage from "./page";
import * as useAnchorWithdrawHook from "@/hooks/useAnchorWithdraw";

jest.mock("@/hooks/useAnchorWithdraw");

const mockUseAnchorWithdraw =
  useAnchorWithdrawHook.useAnchorWithdraw as jest.MockedFunction<
    typeof useAnchorWithdrawHook.useAnchorWithdraw
  >;

const defaultHookReturn = {
  instructions: null,
  status: null,
  withdrawStatus: "idle" as const,
  error: null,
  isLoading: false,
  initiateWithdraw: jest.fn(),
  checkStatus: jest.fn(),
  reset: jest.fn(),
};

describe("WithdrawPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseAnchorWithdraw.mockReturnValue(defaultHookReturn);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders the withdrawal form in idle state", () => {
    render(<WithdrawPage />);

    expect(screen.getByText("Withdraw to Local Currency")).toBeInTheDocument();
    expect(screen.getByLabelText(/Asset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Initiate Withdrawal/i }),
    ).toBeInTheDocument();
  });

  it("calls initiateWithdraw on form submission", async () => {
    const initiateWithdraw = jest.fn();
    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      initiateWithdraw,
    });

    render(<WithdrawPage />);

    const amountInput = screen.getByLabelText(/Amount/i);
    const assetSelect = screen.getByLabelText(/Asset/i);
    const submitButton = screen.getByRole("button", {
      name: /Initiate Withdrawal/i,
    });

    fireEvent.change(assetSelect, { target: { value: "USDC" } });
    fireEvent.change(amountInput, { target: { value: "100.00" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(initiateWithdraw).toHaveBeenCalledWith({
        assetCode: "USDC",
        amount: "100.00",
      });
    });
  });

  it("disables submit button when amount is invalid", () => {
    render(<WithdrawPage />);

    const submitButton = screen.getByRole("button", {
      name: /Initiate Withdrawal/i,
    });

    expect(submitButton).toBeDisabled();

    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: "0" } });

    expect(submitButton).toBeDisabled();
  });

  it("shows instructions when status is pending_user_transfer_start", () => {
    const instructions = {
      id: "withdraw-123",
      type: "interactive",
      how: "Please transfer funds to account ABC",
      eta: 3600,
      instructions: {
        organization: {
          name: "Test Anchor",
          description: "A test anchor service",
        },
      },
    };

    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "pending_user_transfer_start",
      instructions,
    });

    render(<WithdrawPage />);

    expect(
      screen.getByText(/Please follow the instructions below/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Test Anchor")).toBeInTheDocument();
    expect(
      screen.getByText("Please transfer funds to account ABC"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Estimated time: 60 minutes/i)).toBeInTheDocument();
  });

  it("shows transaction details when status is available", () => {
    const status = {
      transaction: {
        id: "txn-123",
        status: "pending_anchor" as const,
        amount_in: "100.00 USDC",
        amount_out: "98.00 USD",
        amount_fee: "2.00 USDC",
      },
    };

    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "pending_anchor",
      status,
    });

    render(<WithdrawPage />);

    expect(screen.getByText("txn-123")).toBeInTheDocument();
    expect(screen.getByText("100.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("98.00 USD")).toBeInTheDocument();
    expect(screen.getByText("2.00 USDC")).toBeInTheDocument();
  });

  it("shows completed status with success icon", () => {
    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "completed",
      status: {
        transaction: {
          id: "txn-123",
          status: "completed" as const,
        },
      },
    });

    render(<WithdrawPage />);

    expect(
      screen.getByText(/Withdrawal completed successfully/i),
    ).toBeInTheDocument();
  });

  it("shows error state when withdrawal fails", () => {
    const error = new Error("Withdrawal failed");
    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "error",
      error,
    });

    render(<WithdrawPage />);

    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });

  it("polls for status updates when transaction is in progress", () => {
    const checkStatus = jest.fn();
    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "pending_anchor",
      status: {
        transaction: {
          id: "txn-123",
          status: "pending_anchor" as const,
        },
      },
      checkStatus,
    });

    render(<WithdrawPage />);

    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000);

    expect(checkStatus).toHaveBeenCalledWith("txn-123");
  });

  it("stops polling when transaction is completed", () => {
    const checkStatus = jest.fn();
    const { rerender } = render(<WithdrawPage />);

    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "pending_anchor",
      status: {
        transaction: {
          id: "txn-123",
          status: "pending_anchor" as const,
        },
      },
      checkStatus,
    });

    rerender(<WithdrawPage />);

    jest.advanceTimersByTime(5000);
    expect(checkStatus).toHaveBeenCalled();

    checkStatus.mockClear();

    // Now simulate completion
    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "completed",
      status: {
        transaction: {
          id: "txn-123",
          status: "completed" as const,
        },
      },
      checkStatus,
    });

    rerender(<WithdrawPage />);

    jest.advanceTimersByTime(10000);
    expect(checkStatus).not.toHaveBeenCalled();
  });

  it("calls reset when starting new withdrawal", () => {
    const reset = jest.fn();
    mockUseAnchorWithdraw.mockReturnValue({
      ...defaultHookReturn,
      withdrawStatus: "completed",
      status: {
        transaction: {
          id: "txn-123",
          status: "completed" as const,
        },
      },
      reset,
    });

    render(<WithdrawPage />);

    const newWithdrawalButton = screen.getByRole("button", {
      name: /Start New Withdrawal/i,
    });
    fireEvent.click(newWithdrawalButton);

    expect(reset).toHaveBeenCalled();
  });
});
