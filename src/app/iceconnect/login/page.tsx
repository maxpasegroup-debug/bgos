"use client";

import { motion } from "framer-motion";
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
      const res = await fetch("/api/auth/login", {
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
      if (
        u.needsOnboarding ||
        u.companyId == null ||
        u.needsWorkspaceActivation
      ) {
        router.push("/onboarding");
        router.refresh();
        return;
      }

      try {
        const [listRes, curRes] = await Promise.all([
          fetch("/api/company/list", { credentials: "include" }),
          fetch("/api/company/current", { credentials: "include" }),
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
        const refreshRes = await fetch("/api/auth/refresh-session", {
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
      console.error("[iceconnect/login] network or unexpected error", err);
      setFormError("Network error");
    } finally {
      setPending(false);
    }
  }

  const inputBase =
    "w-full rounded-lg border border-gray-300 bg-white/80 px-4 py-3 outline-none transition-all duration-300 focus:border-yellow-400/80 focus:ring-2 focus:ring-yellow-400";

  const cardMotion = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF2F7] px-6">
      <motion.div
        className="pointer-events-none absolute top-0 left-0 h-96 w-96 rounded-full bg-yellow-200 opacity-20 blur-3xl"
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, 24, -12, 0], y: [0, 16, 8, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-red-200 opacity-20 blur-3xl"
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, -20, 14, 0], y: [0, -12, -6, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div
        className="relative z-10 w-full max-w-md"
        {...cardMotion}
      >
        <div
          className="rounded-2xl border border-gray-200 bg-white/70 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        >
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="ICECONNECT"
              className="mx-auto mb-4 h-12 w-auto object-contain"
              width={200}
              height={48}
              onError={() => setLogoSrc("/bgos-logo-placeholder.svg")}
            />
            <h1 className="text-center text-xl font-semibold tracking-tight text-gray-900">
              ICECONNECT
            </h1>
            <p className="mt-1 text-center text-sm font-medium text-gray-600">
              Sign in with email and password from your company
            </p>
            <p className="mt-1 text-center text-xs text-gray-400">
              Powered by BGOS • Secure • Intelligent
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
                placeholder="Email"
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
                  emailInvalid
                    ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                    : ""
                }`}
              />
              {fieldErrors.email?.trim() ? (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
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
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                  setFormError(null);
                  setCredentialsMismatch(false);
                }}
                aria-invalid={passwordInvalid}
                className={`${inputBase} ${
                  passwordInvalid
                    ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                    : ""
                }`}
              />
              {fieldErrors.password?.trim() ? (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="text-center text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <motion.button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full rounded-lg bg-gradient-to-r from-red-500 to-yellow-400 py-3 text-center font-semibold text-white shadow-md transition duration-300 hover:shadow-lg hover:brightness-110 disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </motion.button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            Use credentials provided by your company
          </p>

          <p className="mt-6 text-center text-[11px] tracking-wide text-gray-400/90">
            Powered by BGOS
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF2F7] px-6">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-amber-400"
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
