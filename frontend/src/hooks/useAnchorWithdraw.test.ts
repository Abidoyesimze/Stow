import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnchorWithdraw } from "./useAnchorWithdraw";
import * as api from "@/lib/api";

jest.mock("@/lib/api");

const mockApiFetch = api.apiFetch as jest.MockedFunction<typeof api.apiFetch>;

describe("useAnchorWithdraw", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes with correct default values", () => {
    const { result } = renderHook(() => useAnchorWithdraw());

    expect(result.current.instructions).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.withdrawStatus).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("successfully initiates withdrawal", async () => {
    const mockInstructions = {
      id: "withdraw-123",
      type: "interactive_customer_info_needed",
      how: "Please transfer funds to the following account",
      eta: 3600,
    };

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInstructions,
    } as Response);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.initiateWithdraw({
        assetCode: "USDC",
        amount: "100.00",
      });
    });

    await waitFor(() => {
      expect(result.current.instructions).toEqual(mockInstructions);
      expect(result.current.withdrawStatus).toBe("pending_user_transfer_start");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/anchor/withdraw?"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("handles withdrawal initiation error", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ message: "Invalid amount" }),
    } as Response);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.initiateWithdraw({
        assetCode: "USDC",
        amount: "-100",
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("Invalid amount");
      expect(result.current.withdrawStatus).toBe("error");
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("successfully checks withdrawal status", async () => {
    const mockStatus = {
      transaction: {
        id: "withdraw-123",
        status: "completed" as const,
        amount_in: "100.00",
        amount_out: "98.00",
        amount_fee: "2.00",
        started_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T01:00:00Z",
      },
    };

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.checkStatus("withdraw-123");
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(mockStatus);
      expect(result.current.withdrawStatus).toBe("completed");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/anchor/withdraw/withdraw-123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("handles status check error", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ message: "Transaction not found" }),
    } as Response);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.checkStatus("invalid-id");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("Transaction not found");
      expect(result.current.withdrawStatus).toBe("error");
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("handles network errors", async () => {
    const networkError = new Error("Network error");
    mockApiFetch.mockRejectedValueOnce(networkError);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.initiateWithdraw({
        assetCode: "USDC",
        amount: "100.00",
      });
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(networkError);
      expect(result.current.withdrawStatus).toBe("error");
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("resets state correctly", async () => {
    const mockInstructions = {
      id: "withdraw-123",
      type: "interactive",
    };

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInstructions,
    } as Response);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.initiateWithdraw({
        assetCode: "USDC",
        amount: "100.00",
      });
    });

    await waitFor(() => {
      expect(result.current.instructions).toEqual(mockInstructions);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.instructions).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.withdrawStatus).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("includes optional parameters in withdrawal request", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "test" }),
    } as Response);

    const { result } = renderHook(() => useAnchorWithdraw());

    await act(async () => {
      await result.current.initiateWithdraw({
        assetCode: "USDC",
        amount: "100.00",
        account: "GTEST123",
        type: "bank_account",
        dest: "US123456789",
        destExtra: "memo123",
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("account=GTEST123"),
      expect.anything(),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("type=bank_account"),
      expect.anything(),
    );
  });
});
