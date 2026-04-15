"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });
      const j = ((await readApiJson(res, "reset-password")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Password update failed");
      router.replace("/iceconnect/profile");
    } catch (e) {
      setError(formatFetchFailure(e, "Could not reset password"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Reset Password</h1>
      <p className="mt-1 text-sm text-gray-600">
        Your account requires a password reset before continuing.
      </p>
      {error ? <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3 rounded border p-4">
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Temporary password"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Updating..." : "Update password"}
        </button>
      </form>
    </main>
  );
}
