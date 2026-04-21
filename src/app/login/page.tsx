"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isBossRole(role: unknown): boolean {
  return role === "BOSS" || role === "ADMIN";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!loginRes.ok) {
        setError("Invalid email or password.");
        return;
      }

      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      let meJson: { user?: { role?: string; companyType?: string } | null };
      try {
        meJson = (await meRes.json()) as { user?: { role?: string; companyType?: string } | null };
      } catch {
        setError("Unable to verify session. Please try again.");
        return;
      }

      if (!meRes.ok || !meJson?.user) {
        setError("Session could not be established. Please sign in again.");
        return;
      }

      const { user } = meJson;
      const role = user.role;
      const companyType = user.companyType;

      if (role === "BOSS") {
        if (companyType === "SOLAR") {
          router.replace("/solar/dashboard");
        } else {
          router.replace("/dashboard");
        }
        return;
      }

      if (isBossRole(role)) {
        if (companyType === "SOLAR") {
          router.replace("/solar/dashboard");
        } else {
          router.replace("/dashboard");
        }
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <h1 className="text-center text-xl font-semibold tracking-tight">Login</h1>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-white/70">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-white/70">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
              required
            />
          </div>
          {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-400 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
