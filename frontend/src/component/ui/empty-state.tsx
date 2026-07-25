import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "empty" | "error";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "empty",
}: EmptyStateProps) {
  const isError = variant === "error";

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icon && (
        <div
          className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            isError
              ? "bg-red-500/10 text-red-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
      )}

      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
