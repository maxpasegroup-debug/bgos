"use client";

import type { ReactNode } from "react";

type IceconnectWorkspaceViewProps = {
  title: string;
  subtitle: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
  /** Optional hero (e.g. welcome + stats) shown above title when not loading. */
  hero?: ReactNode;
};

export function IceconnectWorkspaceView({
  title,
  subtitle,
  loading,
  error,
  onRetry,
  hero,
  children,
}: IceconnectWorkspaceViewProps) {
  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading workspace">
        <div className="space-y-2">
          <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-white/15" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-white/10" />
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
          <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hero ? <div className="space-y-4">{hero}</div> : null}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {error ? (
        <div
          className="flex flex-col gap-4 rounded-xl border border-red-300/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-red-100">{error}</p>
          <button
            type="button"
            onClick={() => onRetry()}
            className="shrink-0 rounded-lg border border-red-200/30 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 shadow-sm hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
