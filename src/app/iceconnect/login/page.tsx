"use client";

import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { writeStoredCompanyBrand } from "@/contexts/company-branding-context";

const formSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Enter password"),
});

type FieldErrors = { email?: string; password?: string };

function flattenZodFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
  if (!fieldErrors) return {};
  return {
    email: fieldErrors.email?.[0],
    password: fieldErrors.password?.[0],
  };
}

function IceconnectLoginForm() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [credentialsMismatch, setCredentialsMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [logoSrc, setLogoSrc] = useState("/logo.jpg");

  const emailInvalid = Boolean(fieldErrors.email) || credentialsMismatch;
  const passwordInvalid = Boolean(fieldErrors.password) || credentialsMismatch;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setCredentialsMismatch(false);

    const parsed = formSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: fe.email?.[0],
        password: fe.password?.[0],
      });
      return;
    }

    const from = searchParams.get("from");
    const loginBody = {
      email: parsed.data.email,
      password: parsed.data.password,
      ...(from ? { from } : {}),
    };

    setPending(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify(loginBody),
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("Location");
        if (!loc) {
          setFormError("Sign-in failed");
          return;
        }
        window.location.assign(loc);
        return;
      }

      const data = (await res.json()) as {
        success?: boolean;
        ok?: boolean;
        error?: string;
        code?: string;
        details?: unknown;
        nextPath?: string;
        needsCompanySelection?: boolean;
        companies?: { companyId: string; name: string; jobRole: string }[];
        user?: {
          role: string;
          companyId?: string | null;
          needsOnboarding?: boolean;
          needsWorkspaceActivation?: boolean;
        };
      };

      if (!res.ok) {
        if (data.code === "VALIDATION_ERROR" && data.details) {
          const fe = flattenZodFieldErrors(data.details);
          setFieldErrors(fe);
          if (!fe.email && !fe.password && data.error) setFormError(data.error);
          return;
        }
        if (data.code === "WRONG_HOST" && typeof data.error === "string") {
          setFormError(data.error);
          return;
        }
        if (data.code === "CONTACT_ADMIN" && typeof data.error === "string") {
          setFormError(data.error);
          return;
        }
        if (typeof data.error === "string" && data.error.trim()) {
          setFormError(data.error);
          if (data.code === "INVALID_CREDENTIALS") setCredentialsMismatch(true);
        } else {
          setFormError("Sign-in failed");
        }
        return;
      }

      if (data.success !== true || !data.user) {
        setFormError("Invalid sign-in response");
        return;
      }

      const u = data.user;
      if (u.needsOnboarding || u.companyId == null || u.needsWorkspaceActivation) {
        router.push("/onboarding");
        router.refresh();
        return;
      }

      try {
        const [listRes, curRes] = await Promise.all([
          apiFetch("/api/company/list", { credentials: "include" }),
          apiFetch("/api/company/current", { credentials: "include" }),
        ]);
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
        const refreshRes = await apiFetch("/api/auth/refresh-session", {
          method: "POST",
          credentials: "include",
        });
        if (!refreshRes.ok) {
          console.warn("[iceconnect/login] refresh-session failed", refreshRes.status);
        }
        const curJson = (await curRes.json()) as {
          ok?: boolean;
          company?: {
            name: string;
            logoUrl: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
          };
        };
        if (curJson.ok === true && curJson.company) {
          writeStoredCompanyBrand(curJson.company);
        }
      } catch (err) {
        console.warn("[iceconnect/login] post-login company / session step failed", err);
      }

      router.push("/iceconnect");
      router.refresh();
    } catch (err) {
      console.error("API ERROR:", err);
      setFormError(formatFetchFailure(err, "Request failed"));
    } finally {
      setPending(false);
    }
  }

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition-[box-shadow,border-color] duration-200 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/35 focus:ring-offset-0";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
      {/* OS-style deep gradient + very light motion (CSS) */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#0B0F1A_0%,#111827_48%,#020617_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-70 motion-reduce:opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.14), transparent 50%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(59,130,246,0.12), transparent 45%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[min(42rem,85vw)] w-[min(42rem,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.07] blur-3xl motion-reduce:animate-none animate-pulse"
        style={{ animationDuration: "7s" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/4 translate-y-1/4 rounded-full bg-violet-600/[0.06] blur-3xl motion-reduce:animate-none animate-pulse"
        style={{ animationDuration: "9s", animationDelay: "1s" }}
        aria-hidden
      />

      <motion.div
        className="relative z-10 w-full max-w-[420px] group"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] p-8 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)] backdrop-blur-[16px] transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
          {/* Nexa orb — top-right, subtle */}
          <div className="pointer-events-none absolute right-5 top-5 flex flex-col items-center gap-1.5 text-center sm:right-6 sm:top-6">
            <motion.div
              className="relative h-11 w-11 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dbeafe_0%,#60a5fa_45%,#6366f1_100%)] shadow-[0_0_20px_rgba(99,102,241,0.35)]"
              animate={
                reduceMotion ? { scale: 1, opacity: 0.96 } : { scale: [1, 1.06, 1], opacity: [0.92, 1, 0.92] }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
              }
              aria-hidden
            />
            <span className="max-w-[7rem] text-[9px] font-medium uppercase leading-tight tracking-wide text-white/45">
              Powered by Nexa — Your Virtual CEO
            </span>
          </div>

          <div className="pr-16 text-left sm:pr-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="ICECONNECT"
              className="h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,200,0,0.3)]"
              width={220}
              height={56}
              onError={() => setLogoSrc("/bgos-logo-placeholder.svg")}
            />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">ICECONNECT</h1>
            <p className="mt-1 text-sm font-medium text-indigo-100/90">Your Company&apos;s Execution Engine</p>
            <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-white/55">
              Operate teams. Track performance. Close faster.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="ice-email" className="sr-only">
                Email
              </label>
              <input
                id="ice-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your company email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((p) => ({ ...p, email: undefined }));
                  setFormError(null);
                  setCredentialsMismatch(false);
                }}
                aria-invalid={emailInvalid}
                aria-busy={pending}
                className={`${inputBase} ${
                  emailInvalid ? "border-rose-400/50 focus:border-rose-400/60 focus:ring-rose-500/30" : ""
                }`}
              />
              {fieldErrors.email?.trim() ? (
                <p className="mt-1.5 text-xs text-rose-300" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="ice-password" className="sr-only">
                Password
              </label>
              <input
                id="ice-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                  setFormError(null);
                  setCredentialsMismatch(false);
                }}
                aria-invalid={passwordInvalid}
                className={`${inputBase} ${
                  passwordInvalid ? "border-rose-400/50 focus:border-rose-400/60 focus:ring-rose-500/30" : ""
                }`}
              />
              {fieldErrors.password?.trim() ? (
                <p className="mt-1.5 text-xs text-rose-300" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="text-center text-xs text-rose-300" role="alert">
                {formError}
              </p>
            ) : null}

            <motion.button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#ff7a18] to-[#ffb347] py-3.5 text-center text-sm font-semibold text-[#1a0a00] shadow-[0_0_24px_rgba(255,140,60,0.25)] transition-[box-shadow,filter] duration-200 hover:shadow-[0_0_32px_rgba(255,160,80,0.35)] hover:brightness-[1.03] disabled:pointer-events-none disabled:opacity-55"
            >
              {pending ? "Entering…" : "Enter Workspace"}
            </motion.button>
          </form>

          {/* Live system indicators (static display values) */}
          <ul className="mt-5 flex flex-col gap-1.5 border-t border-white/[0.06] pt-5 text-[11px] text-white/55">
            <li className="flex items-center gap-2">
              <span aria-hidden>🔵</span>
              <span>124 teams active</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>🟢</span>
              <span>3,482 tasks completed today</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>⚡</span>
              <span>Real-time execution enabled</span>
            </li>
          </ul>

          <p className="mt-5 text-center text-[10px] leading-relaxed text-white/38">
            Use credentials provided by your organization.
          </p>

          {/* Trust + security strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-5 text-[10px] text-white/42">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>🔒</span>
              Enterprise-grade security
            </span>
            <span className="hidden text-white/25 sm:inline">·</span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>⚡</span>
              Real-time tracking
            </span>
            <span className="hidden text-white/25 sm:inline">·</span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>🌍</span>
              Multi-team collaboration
            </span>
          </div>

          <p className="mt-4 text-center text-[10px] tracking-wide text-white/30">Powered by BGOS</p>
        </div>
      </motion.div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(165deg,#0B0F1A_0%,#111827_48%,#020617_100%)] px-6">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-orange-400"
        aria-hidden
      />
    </div>
  );
}

export default function IceconnectLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <IceconnectLoginForm />
    </Suspense>
  );
}
