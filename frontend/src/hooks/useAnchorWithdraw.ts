import { useState, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";

export type WithdrawStatus =
  | "idle"
  | "requesting"
  | "pending_user_transfer_start"
  | "pending_anchor"
  | "pending_external"
  | "completed"
  | "error";

export interface WithdrawInstructions {
  id: string;
  type: string;
  instructions?: {
    organization?: {
      name: string;
      description?: string;
    };
    fields?: Array<{
      name: string;
      description?: string;
      optional?: boolean;
    }>;
  };
  how?: string;
  eta?: number;
  min_amount?: number;
  max_amount?: number;
  fee_fixed?: number;
  fee_percent?: number;
}

export interface WithdrawStatusResponse {
  transaction: {
    id: string;
    status: WithdrawStatus;
    status_eta?: number;
    amount_in?: string;
    amount_out?: string;
    amount_fee?: string;
    started_at?: string;
    completed_at?: string;
    external_transaction_id?: string;
    message?: string;
  };
}

export interface UseAnchorWithdrawReturn {
  instructions: WithdrawInstructions | null;
  status: WithdrawStatusResponse | null;
  withdrawStatus: WithdrawStatus;
  error: Error | null;
  isLoading: boolean;
  initiateWithdraw: (params: InitiateWithdrawParams) => Promise<void>;
  checkStatus: (transactionId: string) => Promise<void>;
  reset: () => void;
}

export interface InitiateWithdrawParams {
  assetCode: string;
  amount: string;
  account?: string;
  type?: string;
  dest?: string;
  destExtra?: string;
}

export function useAnchorWithdraw(): UseAnchorWithdrawReturn {
  const [instructions, setInstructions] = useState<WithdrawInstructions | null>(
    null,
  );
  const [status, setStatus] = useState<WithdrawStatusResponse | null>(null);
  const [withdrawStatus, setWithdrawStatus] = useState<WithdrawStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const initiateWithdraw = useCallback(
    async (params: InitiateWithdrawParams) => {
      setIsLoading(true);
      setError(null);
      setWithdrawStatus("requesting");

      try {
        const queryParams = new URLSearchParams({
          asset_code: params.assetCode,
          amount: params.amount,
          ...(params.account && { account: params.account }),
          ...(params.type && { type: params.type }),
          ...(params.dest && { dest: params.dest }),
          ...(params.destExtra && { dest_extra: params.destExtra }),
        });

        const response = await apiFetch(
          `/api/anchor/withdraw?${queryParams.toString()}`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          let errorMessage = `Failed to initiate withdrawal: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // Response body is not JSON, use default message
          }
          throw new ApiError(errorMessage, response.status);
        }

        const data = await response.json();
        setInstructions(data);
        setWithdrawStatus("pending_user_transfer_start");
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
        setWithdrawStatus("error");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const checkStatus = useCallback(async (transactionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/anchor/withdraw/${transactionId}`, {
        method: "GET",
      });

      if (!response.ok) {
        let errorMessage = `Failed to check withdrawal status: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Response body is not JSON, use default message
        }
        throw new ApiError(errorMessage, response.status);
      }

      const data = await response.json();
      setStatus(data);
      setWithdrawStatus(data.transaction.status);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred"),
      );
      setWithdrawStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInstructions(null);
    setStatus(null);
    setWithdrawStatus("idle");
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    instructions,
    status,
    withdrawStatus,
    error,
    isLoading,
    initiateWithdraw,
    checkStatus,
    reset,
  };
}
