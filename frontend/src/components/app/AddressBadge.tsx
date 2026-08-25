"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, QrCode, X } from "lucide-react";
import QRCode from "qrcode";

type CopyStatus = "idle" | "copied" | "error";

export interface AddressBadgeProps {
  address: string;
  visibleChars?: number;
  label?: string;
  className?: string;
}

function truncateAddress(address: string, visibleChars: number): string {
  if (address.length <= visibleChars * 2 + 1) return address;
  return `${address.slice(0, visibleChars)}\u2026${address.slice(-visibleChars)}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error("Clipboard API unavailable");
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
}

export default function AddressBadge({
  address,
  visibleChars = 4,
  label,
  className = "",
}: AddressBadgeProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    };
  }, []);

  async function handleCopy() {
    const success = await copyToClipboard(address);
    setStatus(success ? "copied" : "error");
    if (resetTimeout.current) clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => setStatus("idle"), 2000);
  }

  useEffect(() => {
    if (!qrOpen || qrDataUrl) return;
    let cancelled = false;
    QRCode.toDataURL(address, {
      margin: 1,
      width: 220,
      color: { dark: "#05070d", light: "#eef2ff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [qrOpen, qrDataUrl, address]);

  return (
    <div className={`inline-flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs font-medium text-muted">{label}</span>
      )}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2">
        <span
          title={address}
          className="select-all font-mono text-sm text-foreground"
        >
          {truncateAddress(address, visibleChars)}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy address"
          title="Copy address"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {status === "copied" ? (
            <Check className="h-4 w-4 text-brand" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="Show QR code"
          title="Show QR code"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <QrCode className="h-4 w-4" />
        </button>
      </div>

      {status === "error" && (
        <p role="alert" className="text-xs text-red-400">
          Couldn&apos;t copy automatically — please copy manually.
        </p>
      )}

      {qrOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Address QR code"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4 rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {qrError ? (
              <p className="max-w-[220px] text-center text-sm text-red-400">
                Couldn&apos;t generate the QR code.
              </p>
            ) : qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code for ${address}`}
                width={220}
                height={220}
                className="rounded-lg"
              />
            ) : (
              <div
                role="status"
                aria-label="Generating QR code"
                className="h-[220px] w-[220px] animate-pulse rounded-lg bg-white/5"
              />
            )}

            <p className="max-w-[220px] break-all text-center font-mono text-xs text-muted">
              {address}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}