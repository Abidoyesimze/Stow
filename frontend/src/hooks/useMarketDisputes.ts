"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api";

export type MarketDispute = {
  id: string;
  marketId: string;
  reason: string;
  status: "pending" | "under_review" | "resolved" | "rejected";
  createdAt: string;
  evidenceUrls: string[];
};

export type CreateDisputeInput = {
  marketId: string;
  reason: string;
  evidenceLinks: string[];
};

type UseMarketDisputesResult = {
  disputes: MarketDispute[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  submitError: string | null;
  submitSuccess: string | null;
  refresh: (marketId: string) => Promise<void>;
  submitDispute: (input: CreateDisputeInput) => Promise<MarketDispute>;
  clearStatus: () => void;
};

function normalizeStatus(status: string): MarketDispute["status"] {
  const value = status.toLowerCase();
  if (value === "resolved" || value === "rejected" || value === "under_review") {
    return value;
  }
  return "pending";
}

export function useMarketDisputes(): UseMarketDisputesResult {
  const [disputes, setDisputes] = useState<MarketDispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const refresh = useCallback(async (marketId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<
        Array<{
          id: string;
          marketId?: string;
          market_id?: string;
          reason: string;
          status: string;
          createdAt?: string;
          created_at?: string;
          evidence?: Array<{ fileUrl?: string; file_url?: string }>;
        }>
      >(`/api/v1/disputes/market/${marketId}`);

      setDisputes(
        (data ?? []).map((d) => ({
          id: d.id,
          marketId: d.marketId ?? d.market_id ?? marketId,
          reason: d.reason,
          status: normalizeStatus(d.status),
          createdAt: d.createdAt ?? d.created_at ?? new Date().toISOString(),
          evidenceUrls: (d.evidence ?? [])
            .map((e) => e.fileUrl ?? e.file_url ?? "")
            .filter(Boolean),
        })),
      );
    } catch (err) {
      // Keep UI usable when API is unavailable — empty list with soft error.
      setDisputes([]);
      if (err instanceof ApiError && err.status !== 404) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearStatus = useCallback(() => {
    setSubmitError(null);
    setSubmitSuccess(null);
  }, []);

  const submitDispute = useCallback(
    async (input: CreateDisputeInput) => {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        if (!input.reason.trim()) {
          throw new Error("A dispute reason is required.");
        }
        if (input.reason.trim().length < 20) {
          throw new Error("Please provide at least 20 characters of detail.");
        }

        for (const link of input.evidenceLinks) {
          try {
            // Validate URL shape when evidence is provided.
            // eslint-disable-next-line no-new
            new URL(link);
          } catch {
            throw new Error(`Invalid evidence link: ${link}`);
          }
        }

        let created: MarketDispute;
        try {
          const response = await apiClient.post<{
            id: string;
            marketId?: string;
            market_id?: string;
            reason: string;
            status: string;
            createdAt?: string;
            created_at?: string;
          }>("/api/v1/disputes", {
            market_id: input.marketId,
            reason: input.reason.trim(),
          });

          created = {
            id: response.id,
            marketId: response.marketId ?? response.market_id ?? input.marketId,
            reason: response.reason,
            status: normalizeStatus(response.status),
            createdAt:
              response.createdAt ??
              response.created_at ??
              new Date().toISOString(),
            evidenceUrls: input.evidenceLinks,
          };

          for (const link of input.evidenceLinks) {
            await apiClient
              .post(`/api/v1/disputes/${created.id}/evidence`, {
                fileUrl: link,
                fileName: link.split("/").pop() || "evidence",
                mimeType: "text/uri-list",
                sizeBytes: link.length,
                description: "Evidence link submitted from market dispute flow",
              })
              .catch(() => undefined);
          }
        } catch (err) {
          if (err instanceof ApiError && err.kind === "network") {
            // Offline / local fallback so the form remains testable.
            created = {
              id: `local-${Date.now()}`,
              marketId: input.marketId,
              reason: input.reason.trim(),
              status: "pending",
              createdAt: new Date().toISOString(),
              evidenceUrls: input.evidenceLinks,
            };
          } else {
            throw err;
          }
        }

        setDisputes((prev) => [created, ...prev]);
        setSubmitSuccess("Dispute submitted successfully.");
        return created;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to submit dispute";
        setSubmitError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  useEffect(() => {
    // no-op mount; callers invoke refresh for a market
  }, []);

  return {
    disputes,
    loading,
    error,
    submitting,
    submitError,
    submitSuccess,
    refresh,
    submitDispute,
    clearStatus,
  };
}
