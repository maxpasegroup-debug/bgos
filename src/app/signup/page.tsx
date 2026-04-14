"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import {
  EMAIL_ALREADY_IN_USE_MESSAGE,
  NAME_SIMILARITY_EMAIL_UNIQUE_HINT,
} from "@/lib/user-identity-messages";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Your name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fields = signupSchema.safeParse({
      name,
      email,
      password,
    });
    if (!fields.success) {
      const fe = fields.error.flatten().fieldErrors;
      setError(
        fe.name?.[0] ?? fe.email?.[0] ?? fe.password?.[0] ?? "Check the form and try again.",
      );
      return;
    }

    setPending(true);
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields.data),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        code?: string;
        redirect?: string;
      };

      if (!res.ok) {
        if (data.code === "EMAIL_IN_USE" || data.code === "EMAIL_TAKEN") {
          setError(EMAIL_ALREADY_IN_USE_MESSAGE);
        } else {
          const apiText =
            (typeof data.error === "string" && data.error.trim()) ||
            (typeof data.message === "string" && data.message.trim()) ||
            "";
          if (apiText) setError(apiText);
          else if (data.code === "VALIDATION_ERROR") setError("Please check all fields.");
          else setError("Could not create account");
        }
        return;
      }

      router.push(data.redirect ?? "/onboarding");
      router.refresh();
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Request failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <h1 className="text-center text-xl font-semibold tracking-tight">Welcome to BGOS 🚀</h1>
        <p className="mt-1 text-center text-sm text-white/60">Nexa will create your account in 3 quick steps.</p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            Step {step}/3: {step === 1 ? "What should I call you?" : step === 2 ? "What is your email?" : "Create your password"}
          </div>
          {step >= 1 ? (
            <div>
              <label htmlFor="ownerName" className="block text-xs font-medium text-white/70">
                Name
              </label>
              <input
                id="ownerName"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setStep((s) => (s < 2 && name.trim() ? 2 : s))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
              />
              <p className="mt-1 text-xs text-white/45">{NAME_SIMILARITY_EMAIL_UNIQUE_HINT}</p>
            </div>
          ) : null}
          {step >= 2 ? (
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
                onBlur={() => setStep((s) => (s < 3 && email.trim() ? 3 : s))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
              />
            </div>
          ) : null}
          {step >= 3 ? (
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-white/70">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
              />
              <p className="mt-1 text-xs text-white/45">At least 8 characters</p>
            </div>
          ) : null}
          <div className="flex gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                className="w-full rounded-lg border border-white/20 py-2.5 text-sm"
              >
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-400"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-400 disabled:pointer-events-none disabled:opacity-50"
              >
                {pending ? "Creating account…" : "Create account"}
              </button>
            )}
          </div>
          {error ? (
            <p className="text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-cyan-400 hover:text-cyan-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
