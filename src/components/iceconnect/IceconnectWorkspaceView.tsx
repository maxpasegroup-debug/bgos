"use client";

import type { ReactNode } from "react";

type IceconnectWorkspaceViewProps = {
  title: string;
  subtitle: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
};

export function IceconnectWorkspaceView({
  title,
  subtitle,
  loading,
  error,
  onRetry,
  children,
}: IceconnectWorkspaceViewProps) {
  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading workspace">
        <div className="space-y-2">
          <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-white/5" />
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-white/50">{subtitle}</p>
      </div>
      {error ? (
        <div
          className="flex flex-col gap-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => onRetry()}
            className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
