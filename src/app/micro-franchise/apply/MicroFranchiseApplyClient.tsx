"use client";

import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export function MicroFranchiseApplyClient() {
  const searchParams = useSearchParams();
  const ref = useMemo(() => searchParams.get("ref")?.trim() || "", [searchParams]);

  const [step, setStep] = useState<"name" | "phone" | "details" | "submit">("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await apiFetch("/api/micro-franchise/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          location: location.trim() || undefined,
          experience: experience.trim() || undefined,
          ref: ref || undefined,
        }),
      });
      const j = ((await readApiJson(res, "micro-franchise/apply")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || j.ok !== true) {
        setError(typeof j.error === "string" ? j.error : "Could not submit application.");
        return;
      }
      setDone(true);
    } catch (e) {
      setError(formatFetchFailure(e, "Request failed"));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050814] px-4 py-12 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <p className="text-lg font-semibold text-emerald-200">You&apos;re in Nexa&apos;s queue ✓</p>
          <p className="mt-2 text-sm text-white/70">
            We received your micro-franchise application. The BGOS team will review and contact you on your phone.
          </p>
          <Link href="https://bgos.online" className="mt-6 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300">
            Back to BGOS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050814] px-4 py-12 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">Nexa · BGOS Online</p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">Micro Franchise Application</h1>
        <p className="mt-2 text-center text-sm text-white/60">
          A few quick answers — no long forms. {ref ? <span className="text-cyan-200/90">Referred by sales.</span> : null}
        </p>

        <div className="mt-6 space-y-4">
          {step === "name" ? (
            <>
              <label className="block text-xs text-white/60">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none ring-cyan-500/30 focus:ring-2"
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep("phone")}
                className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
              >
                Continue
              </button>
            </>
          ) : null}

          {step === "phone" ? (
            <>
              <label className="block text-xs text-white/60">Phone (required — becomes your referral ID)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none ring-cyan-500/30 focus:ring-2"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("name")} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm">
                  Back
                </button>
                <button
                  type="button"
                  disabled={phone.replace(/\D/g, "").length < 8}
                  onClick={() => setStep("details")}
                  className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          ) : null}

          {step === "details" ? (
            <>
              <label className="block text-xs text-white/60">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none ring-cyan-500/30 focus:ring-2"
              />
              <label className="block text-xs text-white/60">City / region</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none ring-cyan-500/30 focus:ring-2"
              />
              <label className="block text-xs text-white/60">Experience (optional)</label>
              <textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none ring-cyan-500/30 focus:ring-2"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("phone")} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm">
                  Back
                </button>
                <button type="button" onClick={() => setStep("submit")} className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black">
                  Review
                </button>
              </div>
            </>
          ) : null}

          {step === "submit" ? (
            <>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/75">
                <p>
                  <span className="text-white/50">Name:</span> {name}
                </p>
                <p className="mt-1">
                  <span className="text-white/50">Phone:</span> {phone}
                </p>
                {email ? (
                  <p className="mt-1">
                    <span className="text-white/50">Email:</span> {email}
                  </p>
                ) : null}
                {location ? (
                  <p className="mt-1">
                    <span className="text-white/50">Location:</span> {location}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("details")} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm">
                  Back
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void submit()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Submit application"}
                </button>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="text-center text-sm text-amber-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
