"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { resolveAfterLoginNavigation } from "@/lib/cross-domain-login";

const formSchema = z.object({
  mobile: z.string().trim().min(1, "Enter mobile number"),
  password: z.string().min(1, "Enter password"),
});

type FieldErrors = { mobile?: string; password?: string };

function flattenZodFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
  if (!fieldErrors) return {};
  return {
    mobile: fieldErrors.mobile?.[0],
    password: fieldErrors.password?.[0],
  };
}

function IceconnectLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [credentialsMismatch, setCredentialsMismatch] = useState(false);
  const [pending, setPending] = useState(false);

  const mobileInvalid = Boolean(fieldErrors.mobile) || credentialsMismatch;
  const passwordInvalid = Boolean(fieldErrors.password) || credentialsMismatch;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setCredentialsMismatch(false);

    const parsed = formSchema.safeParse({ mobile, password });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        mobile: fe.mobile?.[0],
        password: fe.password?.[0],
      });
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
          mobile: parsed.data.mobile,
          password: parsed.data.password,
          ...(from ? { from } : {}),
        }),
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
        ok?: boolean;
        error?: string;
        code?: string;
        details?: unknown;
      };

      if (!res.ok) {
        if (data.code === "VALIDATION_ERROR" && data.details) {
          const fe = flattenZodFieldErrors(data.details);
          setFieldErrors(fe);
          if (!fe.mobile && !fe.password && data.error) setFormError(data.error);
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

      const role = (data as { user?: { role: string } }).user?.role;
      if (!role) {
        setFormError("Invalid sign-in response");
        return;
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
      router.push(nav.path);
      router.refresh();
    } catch {
      setFormError("Network error");
    } finally {
      setPending(false);
    }
  }

  const inputBase =
    "w-full rounded-lg border px-4 py-3 outline-none transition-[border-color,box-shadow] duration-200 focus:ring-2 focus:ring-yellow-400";

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] bg-gradient-to-b from-white to-[#F1F5F9] px-6 py-10">
      <motion.div
        className="m-auto w-full max-w-md"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bgos-logo-placeholder.svg"
              alt="ICECONNECT"
              className="mx-auto mb-4 h-12 w-auto"
              width={160}
              height={48}
            />
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              ICECONNECT
            </h1>
            <p className="mt-1 text-sm text-gray-500">Access your work dashboard</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="ice-mobile" className="sr-only">
                Mobile number
              </label>
              <input
                id="ice-mobile"
                name="mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Enter mobile number"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setFieldErrors((p) => ({ ...p, mobile: undefined }));
                  setFormError(null);
                  setCredentialsMismatch(false);
                }}
                aria-invalid={mobileInvalid}
                aria-busy={pending}
                className={`${inputBase} ${
                  mobileInvalid
                    ? "border-red-400 focus:border-red-400 focus:ring-red-200"
                    : "border-gray-300"
                }`}
              />
              {fieldErrors.mobile?.trim() ? (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {fieldErrors.mobile}
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
                placeholder="Enter password"
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
                    : "border-gray-300"
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

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="w-full rounded-lg bg-gradient-to-r from-red-500 to-yellow-400 py-3 text-center text-sm font-semibold text-white shadow-sm transition-shadow duration-200 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
              >
                {pending ? "Signing in…" : "Login"}
              </button>
            </motion.div>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="#"
              className="text-sm text-gray-500 underline-offset-2 transition-colors hover:text-gray-800 hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Forgot password?
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">Powered by BGOS</p>
        </div>
      </motion.div>

      {/* Future: OTP toggle */}
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6">
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
