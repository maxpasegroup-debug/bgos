"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IncentivesFeedBanner } from "@/components/incentives/IncentivesFeedBanner";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { publicBgosOrigin } from "@/lib/host-routing";

type PartnerPayload = {
  id: string;
  name: string;
  phone: string;
  referralId: string;
  plan: { id: string; name: string; type: string; value: number; recurring: boolean; instantBonus: number | null } | null;
  wallet: { balance: number; pending: number; totalEarned: number };
  totalReferrals: number;
  activeCustomers: number;
  conversions: number;
  companies: { id: string; name: string; subscriptionStatus: string; plan: string; createdAt: string }[];
  history: {
    id: string;
    amount: number;
    type: string;
    status: string;
    companyName: string;
    companyPlan?: string;
    createdAt: string;
  }[];
  offersCatalog: { id: string; name: string; type: string; value: number; recurring: boolean; instantBonus: number | null }[];
};

function formatDisplayPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  if (d.length >= 12 && d.startsWith("91")) return `+${d.slice(0, 2)} ${d.slice(2, 7)} ${d.slice(7)}`;
  return digits.startsWith("+") ? digits : `+${d}`;
}

function planLabel(plan: string): string {
  switch (plan) {
    case "BASIC":
      return "Basic";
    case "PRO":
      return "Pro";
    case "ENTERPRISE":
      return "Enterprise";
    default:
      return plan;
  }
}

function useCountUp(target: number, durationMs = 900, decimals = 0): number {
  const reduceMotion = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const startVal = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const raw = startVal + (target - startVal) * eased;
      const rounded = decimals > 0 ? Math.round(raw * 10 ** decimals) / 10 ** decimals : Math.round(raw);
      setAnimated(rounded);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs, decimals, reduceMotion]);

  return reduceMotion ? target : animated;
}

function monthlyRollups(
  history: PartnerPayload["history"],
  companies: PartnerPayload["companies"],
): { earnings: { label: string; value: number }[]; referrals: { label: string; value: number }[] } {
  const earnMap = new Map<string, number>();
  for (const h of history) {
    const key = h.createdAt.slice(0, 7);
    earnMap.set(key, (earnMap.get(key) ?? 0) + h.amount);
  }
  const refMap = new Map<string, number>();
  for (const c of companies) {
    const key = c.createdAt.slice(0, 7);
    refMap.set(key, (refMap.get(key) ?? 0) + 1);
  }
  const keys = new Set([...earnMap.keys(), ...refMap.keys()]);
  const sorted = [...keys].sort();
  const last6 = sorted.slice(-6);
  const fmt = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${m}/${y.slice(2)}`;
  };
  return {
    earnings: last6.map((k) => ({ label: fmt(k), value: Math.round((earnMap.get(k) ?? 0) * 100) / 100 })),
    referrals: last6.map((k) => ({ label: fmt(k), value: refMap.get(k) ?? 0 })),
  };
}

const PRODUCT_PLAYBOOK = [
  {
    id: "solar-basic",
    title: "Solar · Basic",
    subtitle: "Fast CRM for growing installers",
    accent: "from-emerald-600/90 to-teal-700/90",
  },
  {
    id: "solar-pro",
    title: "Solar · Pro",
    subtitle: "Automation + deeper pipeline",
    accent: "from-sky-600/90 to-indigo-700/90",
  },
  {
    id: "solar-enterprise",
    title: "Solar · Enterprise",
    subtitle: "Scale + priority support",
    accent: "from-violet-600/90 to-fuchsia-700/90",
  },
  {
    id: "custom",
    title: "Custom setup",
    subtitle: "Paid build — high ticket",
    accent: "from-amber-500/90 to-orange-600/90",
  },
] as const;

function nexaInsight(d: PartnerPayload): string {
  const gap = Math.max(0, 5 - d.totalReferrals);
  if (d.wallet.pending > d.wallet.balance && d.wallet.pending > 0) {
    return `You have ₹${d.wallet.pending.toFixed(0)} pending release — once approved, it moves to your withdrawable balance.`;
  }
  if (gap > 0 && d.activeCustomers < 3) {
    return `You can increase earnings by targeting ${gap} more solar companies this week — share your referral ID with installers you trust.`;
  }
  if (d.conversions > 0 && d.activeCustomers >= d.conversions * 0.5) {
    return `Strong conversion ratio — keep momentum: follow up on live subscriptions before renewal windows.`;
  }
  return `Share your referral ID with every solar boss you meet — Nexa tracks attribution automatically on BGOS launch.`;
}

export function MicroFranchisePartnerDashboardClient() {
  const [data, setData] = useState<PartnerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<"earnings" | "referrals">("earnings");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/micro-franchise/partner/me", { credentials: "include" });
      const j = ((await readApiJson(res, "micro-franchise/partner/me")) ?? {}) as {
        ok?: boolean;
        partner?: PartnerPayload;
        error?: string;
      };
      if (!res.ok || j.ok !== true || !j.partner) {
        setError(j.error || "Could not load dashboard.");
        return;
      }
      setData(j.partner);
    } catch (e) {
      setError(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const displayPhone = data ? formatDisplayPhone(data.referralId) : "";
  const shareUrl = useMemo(() => publicBgosOrigin().replace(/\/+$/, ""), []);
  const referralShareText = useMemo(() => {
    if (!data) return "";
    return `I'm your BGOS micro-franchise partner. When you onboard on BGOS, use my referral phone: ${displayPhone}\nStart here: ${shareUrl}/signup`;
  }, [data, displayPhone, shareUrl]);

  const chartData = useMemo(() => {
    if (!data) return { earnings: [] as { label: string; value: number }[], referrals: [] as { label: string; value: number }[] };
    return monthlyRollups(data.history, data.companies);
  }, [data]);

  const chartSeries = chartTab === "earnings" ? chartData.earnings : chartData.referrals;

  const totalEarnedAnim = useCountUp(data?.wallet.totalEarned ?? 0, 900, 0);
  const pendingAnim = useCountUp(data?.wallet.pending ?? 0, 900, 0);
  const referralsAnim = useCountUp(data?.totalReferrals ?? 0, 700, 0);
  const activeAnim = useCountUp(data?.activeCustomers ?? 0, 700, 0);

  function matchOffer(...hints: string[]) {
    if (!data) return null;
    for (const h of hints) {
      const hit = data.offersCatalog.find((o) => o.name.toLowerCase().includes(h));
      if (hit) return hit;
    }
    return data.plan ?? data.offersCatalog[0] ?? null;
  }

  function shareProductLine(title: string, extra?: string) {
    const body = `${title}\n${extra ?? ""}\nReferral: ${displayPhone}\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  }

  function copyReferral() {
    void navigator.clipboard.writeText(displayPhone).then(
      () => setToast("Referral ID copied"),
      () => setToast("Copy manually from the card"),
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-4 text-sm text-red-200 backdrop-blur">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-400">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
        <p className="text-sm font-medium tracking-tight">Loading your earning workspace…</p>
      </div>
    );
  }

  const insight = nexaInsight(data);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-slate-800/80 bg-[#050814] text-slate-100 shadow-2xl">
      {toast ? (
        <div className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-950/95 px-4 py-2 text-xs font-medium text-emerald-100 shadow-lg backdrop-blur">
          {toast}
        </div>
      ) : null}

      {/* Identity strip */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070b14]/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold tracking-tight text-white">{data.name}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Active
              </span>
            </div>
            <p className="mt-1 font-mono text-sm text-slate-400">
              Referral ID · <span className="text-slate-100">{displayPhone}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              title="Notifications"
            >
              🔔 <span className="hidden sm:inline">Alerts</span>
            </button>
            <Link
              href="/iceconnect/profile"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              ⚙️ <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <IncentivesFeedBanner variant="franchise" />
        {/* Hero stats */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/80 via-[#0c1520] to-[#0a1624] p-5 shadow-[0_20px_50px_-20px_rgba(16,185,129,0.45)]"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/20 blur-2xl" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">Total earnings</p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-white">
              ₹{totalEarnedAnim.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-emerald-200/60">All time · commissions credited</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/70 via-[#121a28] to-[#0c1018] p-5 shadow-[0_20px_50px_-20px_rgba(245,158,11,0.35)]"
          >
            <div className="pointer-events-none absolute -right-4 top-0 h-24 w-24 rounded-full bg-amber-400/15 blur-2xl" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">Pending</p>
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Awaiting release</span>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">₹{pendingAnim.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-amber-100/55">Boss approval → withdrawable balance</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            whileHover={{ y: -2 }}
            className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/60 to-[#0d1422] p-5 shadow-lg"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">Total referrals</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{referralsAnim}</p>
            <p className="mt-1 text-xs text-sky-100/50">Companies linked to you</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            whileHover={{ y: -2 }}
            className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 to-[#101525] p-5 shadow-lg"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-200/80">Active customers</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{activeAnim}</p>
            <p className="mt-1 text-xs text-indigo-100/50">Live subscriptions & trials</p>
          </motion.div>
        </section>

        {/* Performance */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c111c]/90 p-5 shadow-xl backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Performance</h2>
              <p className="mt-0.5 text-xs text-slate-500">Trailing months · your velocity</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
              {(["earnings", "referrals"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChartTab(t)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    chartTab === t ? "bg-emerald-500 text-black shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "earnings" ? "Earnings" : "Referrals"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 h-56 w-full">
            {chartSeries.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No data yet — start sharing.</p>
            ) : chartTab === "earnings" ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mfEarnFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <RechartsTooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(v) => {
                      const n = typeof v === "number" ? v : Number(v);
                      return [`₹${Number.isFinite(n) ? n.toLocaleString("en-IN") : "0"}`, "Earnings"];
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#mfEarnFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <RechartsTooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => {
                      const n = typeof v === "number" ? v : Number(v);
                      return [Number.isFinite(n) ? n : 0, "Companies"];
                    }}
                  />
                  <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Referral */}
          <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-6 shadow-lg">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Your referral ID</h2>
            <p className="mt-4 font-mono text-2xl font-semibold tracking-wide text-white">{displayPhone}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Share this number when your client runs BGOS onboarding — it links the company to you for commissions.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyReferral()}
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow transition hover:bg-slate-100"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(referralShareText)}`, "_blank", "noopener,noreferrer")}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/20"
              >
                Share · WhatsApp
              </button>
            </div>
          </section>

          {/* Nexa */}
          <section className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/50 via-[#0c1524] to-[#0a0f18] p-6 shadow-[0_24px_60px_-28px_rgba(34,211,238,0.35)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-200/90">Nexa insight</h2>
            </div>
            <p className="relative mt-4 text-sm leading-relaxed text-slate-200">{insight}</p>
          </section>
        </div>

        {/* What you can sell */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">What you can sell</h2>
          <p className="mt-1 text-xs text-slate-500">Position BGOS like a product — you earn when they subscribe.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PRODUCT_PLAYBOOK.map((p, i) => {
              const offer =
                p.id === "custom"
                  ? matchOffer("custom", "enterprise")
                  : matchOffer("basic", "default", "solar") ?? data.plan;
              const pct = offer?.type === "PERCENTAGE" ? `${offer.value}%` : `₹${offer?.value ?? "—"}`;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e1522] p-5 shadow-lg"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${p.accent} opacity-40 transition group-hover:opacity-55`} />
                  <div className="relative">
                    <p className="text-sm font-bold text-white">{p.title}</p>
                    <p className="mt-1 text-xs text-slate-300/90">{p.subtitle}</p>
                    <div className="mt-4 space-y-1 text-[11px] text-slate-300/80">
                      <p>
                        Commission · <span className="font-semibold text-emerald-300">{pct}</span>
                      </p>
                      {offer?.instantBonus != null && offer.instantBonus > 0 ? (
                        <p>
                          Bonus · <span className="font-semibold text-amber-200">₹{offer.instantBonus}</span> first win
                        </p>
                      ) : (
                        <p>Bonus · <span className="text-slate-500">per active plan</span></p>
                      )}
                      <p>{offer?.recurring ? "Recurring on renewals" : "One-time / launch"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => shareProductLine(p.title, p.subtitle)}
                      className="mt-5 w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      Share with client
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Wallet */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c111c] p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Wallet</h2>
              <p className="mt-1 text-xs text-slate-500">Withdrawable is released by BGOS finance.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setToast("Payout request recorded — finance will contact you on your registered phone.")
              }
              className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg transition hover:brightness-110"
            >
              Request payout
            </button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-black/25 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total earned</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-300">₹{data.wallet.totalEarned.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-200/70">Withdrawable</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-white">₹{data.wallet.balance.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-200/70">Pending</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-200">₹{data.wallet.pending.toFixed(2)}</p>
            </div>
          </div>
        </section>

        {/* BGOS models */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">BGOS models · quick reference</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-sky-500/30 hover:bg-sky-500/5">
              <p className="text-sm font-semibold text-white">Solar onboarding</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Fast launch: team capture, Nexa parse, instant tenant. Best for installers and EPCs.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-amber-500/30 hover:bg-amber-500/5">
              <p className="text-sm font-semibold text-white">Custom onboarding</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Paid build pipeline: discovery → Razorpay → tech delivery. Higher ticket, longer cycle.
              </p>
            </div>
          </div>
        </section>

        {/* Transactions */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0c111c] p-6 shadow-xl">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Transaction history</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Date</th>
                  <th className="py-3 pr-4 font-semibold">Company</th>
                  <th className="py-3 pr-4 font-semibold">Plan</th>
                  <th className="py-3 pr-4 font-semibold">Amount</th>
                  <th className="py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No commissions yet — your first win shows up here.
                    </td>
                  </tr>
                ) : (
                  data.history.map((h) => (
                    <tr key={h.id} className="border-b border-white/[0.04] text-slate-300 transition hover:bg-white/[0.03]">
                      <td className="py-3 pr-4 text-xs text-slate-500">{new Date(h.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 pr-4 font-medium text-slate-100">{h.companyName}</td>
                      <td className="py-3 pr-4 text-xs">{planLabel(h.companyPlan ?? "BASIC")}</td>
                      <td className="py-3 pr-4 font-semibold tabular-nums text-emerald-300">₹{h.amount.toFixed(2)}</td>
                      <td className="py-3">
                        <span
                          className={
                            h.status === "PENDING"
                              ? "rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200"
                              : h.status === "RELEASED"
                                ? "rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200"
                                : "rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300"
                          }
                        >
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Quick actions — sticky */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4 pt-8">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#070b14]/95 px-3 py-2 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`Hi BGOS — I'm a micro-franchise partner (${data.name}). I want to register a new sales lead.`)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
            className="rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
          >
            ➕ Add lead
          </button>
          <button
            type="button"
            onClick={() => void copyReferral()}
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow"
          >
            🔗 Share referral
          </button>
          <Link
            href="/iceconnect/profile"
            className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/10"
          >
            📞 Support / profile
          </Link>
        </div>
      </div>

      {/* bottom spacer for sticky bar */}
      <div className="h-24" aria-hidden />
    </div>
  );
}
