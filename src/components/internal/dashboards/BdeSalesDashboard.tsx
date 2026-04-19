"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadStatus } from "@prisma/client";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { glassCard, subtleText, accent, btnPrimary, btnGhost } from "@/components/internal/internalUi";

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  status: string;
  statusLabel: string;
  lastActivityAt: string | null;
  updatedAt: string;
};

type Earnings = { today_inr: number; month_inr: number; total_inr: number };

type DailyPlan = {
  ok?: boolean;
  tasks?: string[];
  nexa_messages?: { text?: string }[];
  insights?: string[];
  urgency_level?: string;
};

function daysLeftInMonth(): number {
  const n = new Date();
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0));
  const today = n.getUTCDate();
  return Math.max(0, end.getUTCDate() - today);
}

export function BdeSalesDashboard() {
  const [points, setPoints] = useState<number>(0);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsErr, setLeadsErr] = useState<string | null>(null);
  const [earn, setEarn] = useState<Earnings | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const targetInr = 30_000;

  const load = useCallback(async () => {
    setLeadsErr(null);
    try {
      const [cRes, lRes, eRes, pRes] = await Promise.all([
        apiFetch("/api/internal/context", { credentials: "include" }),
        apiFetch("/api/internal/leads?limit=20&scope=mine", { credentials: "include" }),
        apiFetch("/api/internal/earnings-summary", { credentials: "include" }),
        apiFetch("/api/internal/nexa/daily-plan", { credentials: "include" }),
      ]);
      const cj = (await readApiJson(cRes, "ctx")) as { ok?: boolean; total_points?: number };
      if (cRes.ok && cj.ok) setPoints(typeof cj.total_points === "number" ? cj.total_points : 0);

      const lj = (await readApiJson(lRes, "leads-i")) as { ok?: boolean; leads?: LeadRow[]; error?: string };
      if (!lRes.ok || !lj.ok) {
        setLeadsErr(typeof lj.error === "string" ? lj.error : "Could not load leads");
        setLeads([]);
      } else {
        setLeads(Array.isArray(lj.leads) ? lj.leads : []);
      }

      const ej = (await readApiJson(eRes, "earn")) as Earnings & { ok?: boolean };
      if (eRes.ok && ej.ok !== false) setEarn(ej);

      const pj = (await readApiJson(pRes, "plan")) as DailyPlan;
      if (pRes.ok) setPlan(pj);
    } catch (e) {
      setLeadsErr(formatFetchFailure(e, "Load failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nexaLine = useMemo(() => {
    const m = plan?.nexa_messages?.[0]?.text;
    if (m) return m;
    const t = plan?.tasks?.[0];
    if (t) return t;
    return "Nexa will set your focus for today once coaching data syncs.";
  }, [plan]);

  async function markClosed(leadId: string) {
    setBusyId(leadId);
    try {
      const res = await apiFetch(`/api/internal/leads/${leadId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: LeadStatus.WON }),
      });
      const j = (await readApiJson(res, "lead-patch")) as { ok?: boolean };
      if (res.ok && j.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  const pct = Math.min(100, Math.round((Math.min(points, 20) / 20) * 100));

  return (
    <div className="space-y-6">
      <section className={`${glassCard} p-6 md:p-8`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/90">Hero</p>
            <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">₹{targetInr.toLocaleString("en-IN")} target</h1>
            <p className={`${subtleText} mt-2 max-w-xl`}>
              Points track your sales engine progress — milestone bonuses unlock as you cross network thresholds.
            </p>
          </div>
          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between text-xs text-white/70">
              <span>Points</span>
              <span>
                {points} / 20
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className={`${subtleText} text-xs`}>{daysLeftInMonth()} days left in the month</p>
          </div>
        </div>
        <div className={`${glassCard} mt-6 border-white/[0.05] bg-black/20 p-4`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4FD1FF]/80">Nexa</p>
          <p className="mt-2 text-sm leading-relaxed text-white/85">{nexaLine}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/internal/onboard-company" className={btnPrimary}>
          + Onboard Company
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className={`${glassCard} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Leads</h2>
            <button type="button" className={btnGhost} onClick={() => void load()}>
              Refresh
            </button>
          </div>
          {leadsErr ? <p className="mt-3 text-sm text-amber-300/90">{leadsErr}</p> : null}
          <div className="mt-4 space-y-3">
            {leads.length === 0 && !leadsErr ? (
              <p className={`${subtleText} text-sm`}>No leads assigned to you yet.</p>
            ) : null}
            {leads.map((l) => (
              <div
                key={l.id}
                className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/30 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{l.name}</p>
                  <p className={`${subtleText} text-xs`}>{l.phone}</p>
                  <p className="mt-1 text-xs text-white/70">
                    Status: <span className="text-white">{l.statusLabel}</span>
                  </p>
                  <p className={`${subtleText} text-xs`}>
                    Last activity: {l.lastActivityAt ? new Date(l.lastActivityAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className={btnGhost} href={`tel:${l.phone.replace(/\s/g, "")}`}>
                    Call
                  </a>
                  <a
                    className={btnGhost}
                    href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={busyId === l.id}
                    onClick={() => void markClosed(l.id)}
                  >
                    {busyId === l.id ? "…" : "Mark closed"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${glassCard} p-5`}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/70">Earnings (INR)</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className={subtleText}>Today</dt>
                <dd className="font-semibold text-white">
                  ₹{(earn?.today_inr ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className={subtleText}>This month</dt>
                <dd className="font-semibold text-white">
                  ₹{(earn?.month_inr ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-3">
                <dt className="text-white/80">Total earned</dt>
                <dd className={`font-bold ${accent}`}>
                  ₹{(earn?.total_inr ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </dd>
              </div>
            </dl>
          </div>

          <div className={`${glassCard} p-5`}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/70">Nexa plan</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              {(plan?.tasks ?? []).slice(0, 6).map((t, i) => (
                <li key={`${i}-${t.slice(0, 24)}`} className="flex gap-2">
                  <span className="text-[#4FD1FF]">•</span>
                  <span>{t}</span>
                </li>
              ))}
              {(!plan?.tasks || plan.tasks.length === 0) && (
                <li className={`${subtleText}`}>Tasks appear here from your daily plan.</li>
              )}
            </ul>
            <p className={`${subtleText} mt-3 text-xs`}>
              Urgency: <span className="text-amber-200/90">{plan?.urgency_level ?? "normal"}</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
