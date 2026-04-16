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
    "w-full rounded-xl border border-white/[0.12] bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/38 outline-none transition-[box-shadow,border-color] duration-200 focus:border-sky-400/45 focus:ring-2 focus:ring-sky-500/30 focus:ring-offset-0";

  return (
    <motion.div
      className="relative h-dvh max-h-dvh overflow-hidden text-white"
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Immersive background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#020617_0%,#0f172a_42%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-80 motion-reduce:opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 0% 50%, rgba(56,189,248,0.08), transparent 55%), radial-gradient(ellipse 50% 45% at 100% 20%, rgba(129,140,248,0.09), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/2 h-[28rem] w-[28rem] -translate-y-1/2 rounded-full bg-sky-500/[0.06] blur-3xl motion-reduce:animate-none animate-pulse"
        style={{ animationDuration: "8s" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-violet-600/[0.05] blur-3xl motion-reduce:animate-none animate-pulse"
        style={{ animationDuration: "10s", animationDelay: "0.5s" }}
        aria-hidden
      />

      <div className="relative z-10 grid h-full min-h-0 w-full grid-cols-1 grid-rows-2 lg:grid-cols-[1.2fr_0.8fr] lg:grid-rows-1">
        {/* LEFT — motivation */}
        <motion.section
          className="flex min-h-0 flex-col justify-center px-5 py-5 sm:px-8 sm:py-6 lg:px-14 lg:py-8 xl:px-20"
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[clamp(1.5rem,5.5vw,2.5rem)] font-bold leading-[1.08] tracking-tight text-white lg:text-[clamp(1.85rem,2.8vw,2.5rem)]">
            Build. Close. Grow.
          </p>
          <p className="mt-3 max-w-md text-sm font-medium leading-snug text-white/88 sm:mt-5 sm:text-base lg:text-lg">
            This is your workspace to execute, not just manage.
          </p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/45 sm:mt-4 sm:text-sm">
            Every action matters. Every lead counts. Every day compounds.
          </p>
        </motion.section>

        {/* RIGHT — login + Nexa */}
        <section className="flex min-h-0 items-center justify-center px-4 pb-5 pt-0 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 lg:pt-4">
          <motion.div
            className="group relative w-full max-w-[400px]"
            initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[rgba(255,255,255,0.05)] p-6 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.55)] backdrop-blur-[16px] transition-transform duration-300 ease-out will-change-transform sm:p-8 group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
              {/* Nexa — top-right */}
              <div className="pointer-events-none absolute right-5 top-5 flex flex-col items-end gap-1.5 text-right">
                <motion.div
                  className="h-10 w-10 rounded-full bg-[radial-gradient(circle_at_32%_28%,#bfdbfe_0%,#60a5fa_48%,#7c3aed_100%)] shadow-[0_0_18px_rgba(99,102,241,0.4)]"
                  animate={
                    reduceMotion ? { scale: 1, opacity: 0.95 } : { scale: [1, 1.07, 1], opacity: [0.9, 1, 0.9] }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                  }
                  aria-hidden
                />
                <span className="text-[10px] font-medium tracking-wide text-white/50">Nexa is ready.</span>
              </div>

              <div className="pr-14">
                <h1 className="text-xl font-bold tracking-[0.2em] text-white sm:text-2xl">ICECONNECT</h1>
                <p className="mt-2 text-xs font-medium leading-relaxed text-white/55 sm:text-sm">
                  Your Business Operating System
                </p>
              </div>

              <form className="mt-8 space-y-3.5" onSubmit={onSubmit} noValidate>
                <div>
                  <label htmlFor="ice-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="ice-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your workspace email"
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
                      emailInvalid ? "border-rose-400/45 focus:border-rose-400/55 focus:ring-rose-500/25" : ""
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
                      passwordInvalid ? "border-rose-400/45 focus:border-rose-400/55 focus:ring-rose-500/25" : ""
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
                  transition={{ type: "spring", stiffness: 440, damping: 26 }}
                  className="mt-1 w-full rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fbbf24] py-3.5 text-center text-sm font-bold text-[#1c0a02] shadow-[0_0_28px_rgba(251,146,60,0.28)] transition-[box-shadow,filter] duration-200 hover:shadow-[0_0_36px_rgba(253,186,116,0.38)] hover:brightness-[1.04] disabled:pointer-events-none disabled:opacity-55"
                >
                  {pending ? "Entering…" : "Enter Workspace"}
                </motion.button>

                <p className="pt-1 text-center text-[11px] font-medium tracking-wide text-white/40">
                  Let&apos;s get to work.
                </p>
              </form>

              <p className="mt-6 text-center text-[10px] leading-relaxed text-white/32">
                Intelligence layer: Nexa guides execution inside your workspace.
              </p>
            </div>
          </motion.div>
        </section>
      </div>
    </motion.div>
  );
}

function LoginFallback() {
  return (
    <div className="flex h-dvh max-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#0f172a_42%,#111827_100%)]">
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
