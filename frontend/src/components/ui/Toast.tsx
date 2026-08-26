"use client";

import React from "react";
import { CheckCircle2, ExternalLink, Loader2, X, XCircle } from "lucide-react";

export type ToastVariant = "pending" | "success" | "error";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  message: string;
  /** Optional link to view the transaction (e.g. a Stellar explorer URL). */
  txUrl?: string;
  txLabel?: string;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { border: string; icon: string }
> = {
  pending: { border: "border-brand-2/30", icon: "text-brand-2" },
  success: { border: "border-emerald-400/30", icon: "text-emerald-400" },
  error: { border: "border-red-400/30", icon: "text-red-400" },
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const className = `h-5 w-5 ${VARIANT_STYLES[variant].icon}`;
  if (variant === "pending") {
    return (
      <Loader2
        className={`${className} animate-spin`}
        aria-hidden="true"
        data-testid="toast-icon-pending"
      />
    );
  }
  if (variant === "success") {
    return (
      <CheckCircle2
        className={className}
        aria-hidden="true"
        data-testid="toast-icon-success"
      />
    );
  }
  return (
    <XCircle
      className={className}
      aria-hidden="true"
      data-testid="toast-icon-error"
    />
  );
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const { id, variant, message, txUrl, txLabel } = toast;
  const isAssertive = variant === "error";

  return (
    <div
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
      data-testid={`toast-${variant}`}
      className={`flex items-start gap-3 rounded-xl border ${VARIANT_STYLES[variant].border} bg-background-elevated/95 backdrop-blur px-4 py-3 shadow-lg shadow-black/20 min-w-[280px] max-w-sm`}
    >
      <ToastIcon variant={variant} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{message}</p>
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline focus:outline-none focus:ring-2 focus:ring-brand/50 rounded"
          >
            {txLabel ?? "View transaction"}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50 rounded"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
