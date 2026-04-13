"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function IceconnectWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[iceconnect/workspace]", error);
  }, [error]);

  async function reloadSession() {
    await fetch("/api/auth/refresh-session", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#F8FAFC] px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-gray-900">
          Workspace could not be loaded
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This is usually temporary. Try again, refresh your session, or sign in again if the problem
          continues.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => void reloadSession()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Reload session
          </button>
          <Link
            href="/iceconnect/login"
            className="rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-red-600 hover:text-red-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
