"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ERROR:app/error", error);
  }, [error]);

  const message =
    typeof error?.message === "string" && error.message.trim().length > 0
      ? error.message
      : "An unexpected error occurred.";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#0B0F19] px-4 py-16 text-white antialiased">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight">We hit a snag</h1>
        <p className="mt-3 text-sm text-white/80">{message}</p>
        <p className="mt-2 text-xs text-white/50">
          If this keeps happening, contact your administrator or support with the time of the error.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-cyan-400"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/5"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
