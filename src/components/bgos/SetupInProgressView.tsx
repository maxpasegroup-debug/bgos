"use client";

import { useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";

type SetupStatusPayload = {
  success?: boolean;
  companyName?: string;
  onboardingStatus?: string;
  estimatedDays?: string;
  bossEmail?: string;
  partner?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export function SetupInProgressView() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/onboarding/setup-status", { credentials: "include" });
        const json = ((await readApiJson(res, "setup-status")) ?? {}) as SetupStatusPayload;
        if (!cancelled && res.ok && json.success) {
          setStatus(json);
        }
      } catch {
        // Keep the fallback shell if the request blips.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const partnerName = status?.partner?.name?.trim() || "Your Micro Franchise Partner";
  const partnerPhone = status?.partner?.phone?.trim() || status?.partner?.email?.trim() || "Assigned shortly";

  return (
    <section className="px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(circle_at_top,#164e63_0%,#0f172a_38%,#020617_100%)] p-6 text-slate-100 shadow-[0_24px_80px_-36px_rgba(34,211,238,0.6)] sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
          Setup In Progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          Nexa is preparing your command center
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-200/88">
          We received your setup details{status?.companyName ? ` for ${status.companyName}` : ""}. Our team is
          building your custom dashboards now.
        </p>

        <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Estimated</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {loading ? "Checking timeline..." : status?.estimatedDays || "2-3 business days"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Status</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {status?.onboardingStatus === "under_review" ? "SDE review started" : "Preparing your workspace"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">What happens next</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-200/88">
            <p>✓ SDE reviews your requirements</p>
            <p>✓ Builds each dashboard</p>
            <p>✓ Tests everything</p>
            <p>✓ You get notified when ready</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">We will email</p>
            <p className="mt-2 text-sm font-medium text-white">{status?.bossEmail || "your registered email"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Partner contact</p>
            <p className="mt-2 text-sm font-medium text-white">{partnerName}</p>
            <p className="mt-1 text-sm text-slate-300">{partnerPhone}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
