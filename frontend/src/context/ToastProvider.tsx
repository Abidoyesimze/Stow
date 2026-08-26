"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Toast, { type ToastData, type ToastVariant } from "@/components/ui/Toast";

/** Auto-dismiss delay per variant, in ms. `null` means "stays until updated or dismissed". */
const DEFAULT_DURATIONS: Record<ToastVariant, number | null> = {
  pending: null,
  success: 5000,
  error: 7000,
};

export interface ShowToastOptions {
  variant: ToastVariant;
  message: string;
  txUrl?: string;
  txLabel?: string;
  /** Override the default auto-dismiss delay. `null` disables auto-dismiss. */
  duration?: number | null;
}

export type UpdateToastOptions = Partial<ShowToastOptions>;

interface ToastContextValue {
  toasts: ToastData[];
  showToast: (options: ShowToastOptions) => string;
  updateToast: (id: string, patch: UpdateToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${idCounter}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastsRef = useRef<ToastData[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const scheduleAutoDismiss = useCallback(
    (id: string, variant: ToastVariant, duration: number | null | undefined) => {
      clearTimer(id);
      const resolved = duration === undefined ? DEFAULT_DURATIONS[variant] : duration;
      if (resolved === null) return;
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), resolved),
      );
    },
    [clearTimer, dismissToast],
  );

  const showToast = useCallback(
    (options: ShowToastOptions) => {
      const id = nextId();
      const toast: ToastData = {
        id,
        variant: options.variant,
        message: options.message,
        txUrl: options.txUrl,
        txLabel: options.txLabel,
      };
      setToasts((prev) => [...prev, toast]);
      scheduleAutoDismiss(id, options.variant, options.duration);
      return id;
    },
    [scheduleAutoDismiss],
  );

  const updateToast = useCallback(
    (id: string, patch: UpdateToastOptions) => {
      const existing = toastsRef.current.find((t) => t.id === id);
      if (!existing) return;

      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );

      if (patch.variant !== undefined || patch.duration !== undefined) {
        scheduleAutoDismiss(id, patch.variant ?? existing.variant, patch.duration);
      }
    },
    [scheduleAutoDismiss],
  );

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((timer) => clearTimeout(timer));
      timerMap.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, updateToast, dismissToast }}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full sm:w-auto">
            <Toast toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
