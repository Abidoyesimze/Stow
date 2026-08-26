import React from 'react';
import { AlertCircle, RefreshCw, ServerCrash, WifiOff } from 'lucide-react';

export interface ErrorRetryProps {
  error?: Error | { message?: string, status?: number } | string | unknown;
  onRetry: () => void;
  className?: string;
}

export default function ErrorRetry({ error, onRetry, className = '' }: ErrorRetryProps) {
  let isNetworkError = false;
  let isServerError = false;
  let errorMessage = 'An unexpected error occurred. Please try again.';

  if (error) {
    let errorStr = '';
    
    if (typeof error === 'string') {
      errorStr = error;
    } else if (error instanceof Error) {
      errorStr = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorStr = (error as any).message || '';
    }

    const errorLower = errorStr.toLowerCase();
    const errorObj = error as any;
    
    isNetworkError = 
      errorLower.includes('network') || 
      errorLower.includes('failed to fetch') || 
      errorObj?.name === 'NetworkError' ||
      (errorObj?.isAxiosError && !errorObj?.response);

    const status = errorObj?.status || errorObj?.response?.status;
    isServerError = (typeof status === 'number' && status >= 500) || errorLower.includes('server');

    if (isNetworkError) {
      errorMessage = 'Network connection failed. Please check your internet and try again.';
    } else if (isServerError) {
      errorMessage = 'We encountered a server error. Please try again later.';
    } else if (errorStr) {
      errorMessage = errorStr;
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-border bg-card ${className}`}>
      <div className="mb-4 text-red-400">
        {isNetworkError ? (
          <WifiOff className="h-10 w-10" aria-hidden="true" data-testid="icon-network" />
        ) : isServerError ? (
          <ServerCrash className="h-10 w-10" aria-hidden="true" data-testid="icon-server" />
        ) : (
          <AlertCircle className="h-10 w-10" aria-hidden="true" data-testid="icon-alert" />
        )}
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Failed to load data</h3>
      <p className="text-muted mb-6 max-w-sm">{errorMessage}</p>
      <button
        onClick={onRetry}
        className="group flex items-center justify-center gap-2 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 px-5 py-2.5 text-sm font-medium text-brand transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
      >
        <RefreshCw className="h-4 w-4 transition-transform group-hover:-rotate-180 duration-500" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}
