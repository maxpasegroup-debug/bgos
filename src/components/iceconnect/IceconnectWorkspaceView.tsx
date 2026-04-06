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
      <div className="space-y-8" aria-busy="true" aria-label="Loading workspace">
        <div className="space-y-2">
          <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-gray-200/80" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-gray-100" />
        </div>
        <div className="space-y-3 rounded-xl border border-gray-200/80 bg-white/70 p-4 shadow-sm">
          <div className="h-5 w-28 animate-pulse rounded bg-gray-200/80" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {hero ? <div className="space-y-4">{hero}</div> : null}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      {error ? (
        <div
          className="flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50/90 p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => onRetry()}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-900 shadow-sm hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
