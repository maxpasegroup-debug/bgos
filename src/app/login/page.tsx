"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { resolveAfterLoginNavigation } from "@/lib/cross-domain-login";

const clientLoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fields = clientLoginSchema.safeParse({ email, password });
    if (!fields.success) {
      const first = fields.error.flatten().fieldErrors;
      const msg =
        first.email?.[0] ?? first.password?.[0] ?? "Check the form and try again.";
      setError(msg);
      return;
    }
    setPending(true);
    try {
      const from = searchParams.get("from");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({
          email: fields.data.email,
          password: fields.data.password,
          ...(from ? { from } : {}),
        }),
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("Location");
        if (!loc) {
          setError("Sign-in failed");
          return;
        }
        window.location.assign(loc);
        return;
      }

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        nextPath?: string;
        needsCompanySelection?: boolean;
        companies?: unknown[];
        isSuperBoss?: boolean;
        user?: {
          role: string;
          companyId?: string | null;
          needsOnboarding?: boolean;
          needsWorkspaceActivation?: boolean;
        };
      };
      if (!res.ok) {
        if (data.code === "CONTACT_ADMIN" && typeof data.error === "string") {
          setError(data.error);
          return;
        }
        if (typeof data.error === "string" && data.error.trim()) {
          setError(data.error);
        } else if (data.code === "VALIDATION_ERROR") {
          setError("Please check your email and password.");
        } else {
          setError("Sign-in failed");
        }
        return;
      }
      if (data.isSuperBoss === true) {
        try {
          await fetch("/api/auth/refresh-session", {
            method: "POST",
            credentials: "include",
          }).catch(() => undefined);
        } catch {
          /* non-fatal */
        }
        router.push("/bgos/control");
        router.refresh();
        return;
      }

      if (
        data.user?.needsOnboarding ||
        data.user?.companyId == null ||
        data.user?.needsWorkspaceActivation
      ) {
        router.push("/onboarding");
        router.refresh();
        return;
      }
      const role = data.user?.role;
      if (!role) {
        setError("Invalid sign-in response");
        return;
      }

      try {
        const listRes = await fetch("/api/company/list", { credentials: "include" });
        const listJson = (await listRes.json()) as { ok?: boolean; companies?: unknown[] };
        const multiCompany =
          data.needsCompanySelection === true ||
          (listJson.ok && Array.isArray(listJson.companies) && listJson.companies.length > 1) ||
          (Array.isArray(data.companies) && data.companies.length > 1);
        if (multiCompany) {
          router.push("/iceconnect/select-company");
          router.refresh();
          return;
        }
        await fetch("/api/auth/refresh-session", {
          method: "POST",
          credentials: "include",
        }).catch(() => undefined);
      } catch {
        /* non-fatal */
      }

      const nav = resolveAfterLoginNavigation({
        role,
        from,
        hostname: typeof window !== "undefined" ? window.location.hostname : "",
      });
      if (nav.kind === "external") {
        window.location.assign(nav.url);
        return;
      }
      const serverPath =
        typeof data.nextPath === "string" && data.nextPath.startsWith("/") ? data.nextPath : null;
      router.push(serverPath ?? nav.path);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <h1 className="text-center text-xl font-semibold tracking-tight">BGOS Sign in</h1>
        <p className="mt-1 text-center text-sm text-white/60">Email and password</p>
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          {error ? (
            <p className="text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-400 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          New to BGOS?{" "}
          <Link href="/signup" className="font-medium text-cyan-400 hover:text-cyan-300">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F19] px-4 text-white/60">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400"
            aria-hidden
          />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
