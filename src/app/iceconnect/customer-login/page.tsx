"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IceconnectCustomerLoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile, password }),
      });
      const j = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Login failed");
        return;
      }
      router.replace("/iceconnect/customer");
    } catch {
      setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-16">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="text-xl font-semibold text-white">Customer Login</h1>
        <p className="mt-1 text-sm text-white/65">View your installation, loan, documents, and service updates.</p>
        <label className="mt-4 block text-xs text-white/70">Mobile</label>
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1 w-full rounded-lg border border-white/12 bg-black/35 p-2 text-sm text-white" />
        <label className="mt-3 block text-xs text-white/70">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-white/12 bg-black/35 p-2 text-sm text-white" />
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <button onClick={() => void submit()} disabled={busy} className="mt-4 w-full rounded-lg bg-[#FFC300] px-4 py-2 text-sm font-semibold text-black disabled:opacity-70">
          {busy ? "Signing in..." : "Login"}
        </button>
      </div>
    </main>
  );
}
