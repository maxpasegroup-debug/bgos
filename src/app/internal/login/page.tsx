"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function InternalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      setError(errs.email?.[0] ?? errs.password?.[0] ?? "Check the form and try again.");
      return;
    }

    setPending(true);
    try {
      const loginRes = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
          respondWithJson: true,
        }),
      });

      const loginData = (await loginRes.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };

      if (!loginRes.ok) {
        setError(
          typeof loginData.error === "string" && loginData.error.trim()
            ? loginData.error
            : "Sign-in failed",
        );
        return;
      }

      // Check internal role
      const sessionRes = await apiFetch("/api/internal/session");
      const sessionData = (await sessionRes.json()) as {
        ok?: boolean;
        isInternal?: boolean;
        nextPath?: string | null;
        roleLabel?: string | null;
      };

      if (!sessionData.ok || !sessionData.isInternal || !sessionData.nextPath) {
        setError("This portal is for internal BGOS staff only. Your account does not have internal access.");
        return;
      }

      router.replace(sessionData.nextPath);
      router.refresh();
    } catch (e) {
      setError(formatFetchFailure(e, "Sign-in request failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium tracking-widest text-amber-400 uppercase">
            Internal
          </span>
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight">BGOS Staff Portal</h1>
        <p className="mt-1 text-center text-sm text-white/50">Internal access only</p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-white/70">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error !== null}
              aria-busy={pending}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-white/70">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error !== null}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-black transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
