"use client";

import React, { useState, useEffect } from "react";
import { useAnchorWithdraw } from "@/hooks/useAnchorWithdraw";
import ErrorRetry from "@/components/ui/ErrorRetry";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [assetCode, setAssetCode] = useState("USDC");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );

  const {
    instructions,
    status,
    withdrawStatus,
    error,
    isLoading,
    initiateWithdraw,
    checkStatus,
    reset,
  } = useAnchorWithdraw();

  // Poll for status updates when we have a transaction ID
  useEffect(() => {
    if (
      !transactionId ||
      withdrawStatus === "completed" ||
      withdrawStatus === "error"
    ) {
      return;
    }

    const interval = setInterval(() => {
      checkStatus(transactionId);
    }, 5000); // Poll every 5 seconds

    setPollingInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [transactionId, withdrawStatus, checkStatus]);

  // Stop polling when transaction is complete or error
  useEffect(() => {
    if (withdrawStatus === "completed" || withdrawStatus === "error") {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [withdrawStatus, pollingInterval]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    await initiateWithdraw({
      assetCode,
      amount,
    });
  };

  const handleReset = () => {
    reset();
    setAmount("");
    setTransactionId(null);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const renderStatusIcon = () => {
    switch (withdrawStatus) {
      case "completed":
        return <CheckCircle2 className="h-12 w-12 text-green-400" />;
      case "error":
        return <AlertCircle className="h-12 w-12 text-red-400" />;
      case "requesting":
        return <Loader2 className="h-12 w-12 text-brand animate-spin" />;
      default:
        return <Clock className="h-12 w-12 text-yellow-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (withdrawStatus) {
      case "idle":
        return "";
      case "requesting":
        return "Initiating withdrawal...";
      case "pending_user_transfer_start":
        return "Please follow the instructions below to complete your withdrawal.";
      case "pending_anchor":
        return "Waiting for anchor to process...";
      case "pending_external":
        return "Processing external transfer...";
      case "completed":
        return "Withdrawal completed successfully!";
      case "error":
        return "Withdrawal failed. Please try again.";
      default:
        return "Processing withdrawal...";
    }
  };

  if (error && withdrawStatus === "error") {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl">
          <ErrorRetry error={error} onRetry={handleReset} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ArrowDownToLine className="h-8 w-8 text-brand" />
            <h1 className="text-3xl font-semibold text-foreground">
              Withdraw to Local Currency
            </h1>
          </div>
          <p className="text-muted">
            Withdraw your assets to local currency via an anchor service.
          </p>
        </div>

        {withdrawStatus === "idle" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="asset"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Asset
                  </label>
                  <select
                    id="asset"
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                    disabled={isLoading}
                  >
                    <option value="USDC">USDC</option>
                    <option value="XLM">XLM</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="amount"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Amount
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
              className="w-full rounded-xl bg-brand/20 hover:bg-brand/30 border border-brand/40 px-6 py-3 text-sm font-medium text-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              {isLoading ? "Processing..." : "Initiate Withdrawal"}
            </button>
          </form>
        )}

        {withdrawStatus !== "idle" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4">{renderStatusIcon()}</div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {getStatusMessage()}
                </h2>

                {status && (
                  <div className="mt-4 w-full space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-t border-border">
                      <span className="text-muted">Transaction ID</span>
                      <span className="text-foreground font-mono">
                        {status.transaction.id}
                      </span>
                    </div>
                    {status.transaction.amount_in && (
                      <div className="flex justify-between py-2 border-t border-border">
                        <span className="text-muted">Amount In</span>
                        <span className="text-foreground">
                          {status.transaction.amount_in}
                        </span>
                      </div>
                    )}
                    {status.transaction.amount_out && (
                      <div className="flex justify-between py-2 border-t border-border">
                        <span className="text-muted">Amount Out</span>
                        <span className="text-foreground">
                          {status.transaction.amount_out}
                        </span>
                      </div>
                    )}
                    {status.transaction.amount_fee && (
                      <div className="flex justify-between py-2 border-t border-border">
                        <span className="text-muted">Fee</span>
                        <span className="text-foreground">
                          {status.transaction.amount_fee}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {instructions && (
                  <div className="mt-6 w-full rounded-xl bg-background-elevated border border-border p-4 text-left">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Instructions
                    </h3>
                    {instructions.instructions?.organization && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-foreground">
                          {instructions.instructions.organization.name}
                        </p>
                        {instructions.instructions.organization.description && (
                          <p className="text-xs text-muted mt-1">
                            {instructions.instructions.organization.description}
                          </p>
                        )}
                      </div>
                    )}
                    {instructions.how && (
                      <p className="text-sm text-muted whitespace-pre-wrap">
                        {instructions.how}
                      </p>
                    )}
                    {instructions.eta && (
                      <p className="text-xs text-muted mt-2">
                        Estimated time: {Math.round(instructions.eta / 60)}{" "}
                        minutes
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full rounded-xl border border-border bg-card hover:bg-card/70 px-6 py-3 text-sm font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              Start New Withdrawal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
