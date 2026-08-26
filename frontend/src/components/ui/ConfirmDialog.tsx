import React, { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the first button when dialog opens
    firstFocusableRef.current?.focus();

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Handle tab key for focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleTab);

    // Prevent body scroll when dialog is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleTab);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const variantStyles = {
    danger: {
      icon: "text-red-400",
      confirmButton:
        "bg-red-500/20 hover:bg-red-500/30 border-red-500/40 text-red-300",
    },
    warning: {
      icon: "text-yellow-400",
      confirmButton:
        "bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/40 text-yellow-300",
    },
    info: {
      icon: "text-brand",
      confirmButton: "bg-brand/20 hover:bg-brand/30 border-brand/40 text-brand",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl mx-4"
        role="document"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-card hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 ${styles.icon}`}>
            <AlertCircle className="h-12 w-12" aria-hidden="true" />
          </div>

          <h2
            id="dialog-title"
            className="text-xl font-semibold text-foreground mb-3"
          >
            {title}
          </h2>

          <div
            id="dialog-description"
            className="text-muted text-sm mb-6 max-w-sm"
          >
            {body}
          </div>

          <div className="flex gap-3 w-full">
            <button
              ref={lastFocusableRef}
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-card hover:bg-card/70 px-4 py-2.5 text-sm font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              {cancelText}
            </button>
            <button
              ref={firstFocusableRef}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50 ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
