"use client";

import { LeadStatus } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo } from "react";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";
import { NexaAnnouncementsStrip } from "@/components/bgos/nexa/NexaAnnouncementsStrip";
import { NexaCompetitionsStrip } from "@/components/bgos/nexa/NexaCompetitionsStrip";
import { NexaTodaysGamePlan } from "@/components/bgos/nexa/NexaTodaysGamePlan";
import type { DashboardMetrics, PipelineStageCount } from "@/types";

const card =
  "rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-lg transition-all duration-200 hover:scale-[1.01] hover:border-indigo-400/20 hover:shadow-indigo-500/10";

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function countForStages(pipeline: PipelineStageCount[], stages: string[]): number {
  const set = new Set(stages);
  return pipeline.filter((p) => set.has(p.stage)).reduce((s, p) => s + p.count, 0);
}

function totalPipeline(pipeline: PipelineStageCount[]): number {
  return pipeline.reduce((s, p) => s + p.count, 0);
}

export function SolarBossDashboard({
  dashboard,
  userName,
  companyName,
  metricsUnavailable,
}: {
  dashboard: DashboardMetrics | null;
  userName: string;
  companyName: string | null;
  metricsUnavailable: boolean;
}) {
  const { hasProPlan, planLockedToBasic, trialReadOnly } = useBgosDashboardContext();

  const empty = useMemo(() => {
    if (metricsUnavailable || !dashboard) return true;
    const p = dashboard.pipeline ?? [];
    const t = totalPipeline(p);
    const rev = dashboard.analytics?.revenue ?? 0;
    const leadsPeriod = dashboard.analytics?.leads ?? 0;
    return t === 0 && rev === 0 && leadsPeriod === 0 && (dashboard.leads ?? 0) === 0;
  }, [dashboard, metricsUnavailable]);

  const heroCopy = useMemo(() => {
    if (!dashboard || metricsUnavailable) {
      return { title: "Welcome back", sub: "Loading your workspace…", variant: "neutral" as const };
    }
    const pipeline = dashboard.pipeline ?? [];
    const total = totalPipeline(pipeline);
    const hot =
      countForStages(pipeline, [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.QUALIFIED,
        LeadStatus.SITE_VISIT_SCHEDULED,
      ]) + (dashboard.nexa?.opportunities ?? 0);
    const trend = dashboard.analytics?.trend ?? [];
    let revenueDropPct: number | null = null;
    if (trend.length >= 2) {
      const a = trend[trend.length - 2]?.revenue ?? 0;
      const b = trend[trend.length - 1]?.revenue ?? 0;
      if (a > 0 && b < a) revenueDropPct = Math.round(((a - b) / a) * 100);
    }

    if (total === 0 && (dashboard.analytics?.leads ?? 0) === 0) {
      return {
        title: `Welcome back, ${userName}`,
        sub: "Let's start your first solar deal",
        variant: "empty" as const,
      };
    }
    if (revenueDropPct !== null && revenueDropPct > 0) {
      return {
        title: `Welcome back, ${userName}`,
        sub: `Revenue dropped ${revenueDropPct}% — let's fix it`,
        variant: "alert" as const,
      };
    }
    if (hot > 0) {
      return {
        title: `Welcome back, ${userName}`,
        sub: `You have ${hot} hot leads today`,
        variant: "hot" as const,
      };
    }
    return {
      title: `Welcome back, ${userName}`,
      sub: "Here's your business pulse",
      variant: "neutral" as const,
    };
  }, [dashboard, metricsUnavailable, userName]);

  const progress = useMemo(() => {
    if (!dashboard) {
      return [
        { id: "setup", label: "Business Setup", done: true },
        { id: "lead", label: "Add First Lead", done: false },
        { id: "deal", label: "Close First Deal", done: false },
        { id: "team", label: "Add Team", done: false },
      ];
    }
    const p = dashboard.pipeline ?? [];
    const anyLead =
      totalPipeline(p) > 0 || (dashboard.analytics?.leads ?? 0) > 0 || (dashboard.leads ?? 0) > 0;
    const won =
      countForStages(p, [LeadStatus.WON]) > 0 || (dashboard.analytics?.revenue ?? 0) > 0;
    const teamOk = (dashboard.hr?.totalEmployees ?? 0) >= 2 || (dashboard.team?.length ?? 0) >= 1;
    return [
      { id: "setup", label: "Business Setup", done: true },
      { id: "lead", label: "Add First Lead", done: anyLead },
      { id: "deal", label: "Close First Deal", done: won },
      { id: "team", label: "Add Team", done: teamOk },
    ];
  }, [dashboard]);

  const miniPipeline = useMemo(() => {
    if (!dashboard?.pipeline?.length) {
      return [
        { key: "new", label: "New", count: 0 },
        { key: "site", label: "Site Visit", count: 0 },
        { key: "quote", label: "Quote", count: 0 },
        { key: "close", label: "Close", count: 0 },
      ];
    }
    const pipeline = dashboard.pipeline;
    const site = countForStages(pipeline, [
      LeadStatus.SITE_VISIT_SCHEDULED,
      LeadStatus.SITE_VISIT_COMPLETED,
    ]);
    const quote = countForStages(pipeline, [
      LeadStatus.PROPOSAL_SENT,
      LeadStatus.NEGOTIATION,
      LeadStatus.PROPOSAL_WON,
    ]);
    const close = countForStages(pipeline, [LeadStatus.WON]);
    const neu = countForStages(pipeline, [LeadStatus.NEW]);
    return [
      { key: "new", label: "New", count: neu },
      { key: "site", label: "Site Visit", count: site },
      { key: "quote", label: "Quote", count: quote },
      { key: "close", label: "Close", count: close },
    ];
  }, [dashboard]);

  const topTeam = useMemo(() => {
    const t = dashboard?.team ?? [];
    if (!t.length) return null;
    return [...t].sort((a, b) => (b.wonLeads ?? 0) - (a.wonLeads ?? 0))[0] ?? null;
  }, [dashboard]);

  const salesBoosterHref =
    hasProPlan && !planLockedToBasic ? "/sales-booster" : "/bgos/pricing";

  if (empty && !metricsUnavailable) {
    return (
      <div className="relative pb-28">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-3xl px-4 pt-6 sm:px-6"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/80 via-[#0f172a] to-violet-950/50 p-8 shadow-[0_0_60px_-20px_rgba(99,102,241,0.35)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <p className="text-sm font-medium text-indigo-200/90">Nexa</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Your system is ready — let&apos;s get started
            </h2>
            <p className="mt-3 text-sm text-white/60">
              {companyName ? `${companyName} · ` : null}
              Add your first lead, set pricing, and invite your team when you&apos;re ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/bgos/sales"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
              >
                Add first lead
              </Link>
              <Link
                href="/bgos/subscription"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                Add pricing
              </Link>
              <Link
                href="/bgos/team"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                Invite team
              </Link>
            </div>
          </div>
        </motion.section>

        <Link
          href="/bgos/nexa"
          className="fixed bottom-6 right-5 z-40 flex items-center gap-2 rounded-full border border-indigo-400/30 bg-gradient-to-r from-indigo-600/90 to-violet-700/90 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_-8px_rgba(99,102,241,0.55)] backdrop-blur-md transition hover:scale-[1.03] hover:shadow-indigo-500/40"
        >
          <span aria-hidden>💬</span> Ask Nexa
        </Link>
      </div>
    );
  }

  const ops = dashboard?.operations;
  const inv = dashboard?.inventory;
  const fin = dashboard?.financial;
  const revB = dashboard?.revenueBreakdown;
  const health = dashboard?.health;

  return (
    <div className="relative pb-28">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl px-4 pt-5 sm:px-6"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-[#0f172a] to-indigo-950/60 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:p-8">
          <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-48 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Nexa</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {heroCopy.title}
            </h1>
            <p
              className={`mt-2 text-sm sm:text-base ${
                heroCopy.variant === "alert" ? "text-amber-200/90" : "text-white/60"
              }`}
            >
              {heroCopy.sub}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/bgos/sales"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Add Lead
              </Link>
              <Link
                href="/bgos/sales"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                View Pipeline
              </Link>
              <Link
                href="/bgos/inventory"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                Check Inventory
              </Link>
              <Link
                href={salesBoosterHref}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 text-sm font-semibold text-amber-100/95 transition hover:bg-amber-500/15"
              >
                {hasProPlan && !planLockedToBasic ? "Sales Booster" : "Sales Booster — Upgrade"}
              </Link>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">System setup progress</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {progress.map((step) => (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 text-sm text-white/75"
                  >
                    <span className={step.done ? "text-emerald-400" : "text-white/35"}>
                      {step.done ? "✓" : "○"}
                    </span>
                    {step.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mx-auto mt-6 max-w-6xl space-y-4 px-4 sm:px-6">
        <NexaAnnouncementsStrip />
        <div className="grid gap-4 lg:grid-cols-2">
          <NexaTodaysGamePlan />
          <NexaCompetitionsStrip />
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={card}>
          <h3 className="text-xl font-semibold text-white">Sales snapshot</h3>
          <p className="mt-1 text-sm text-white/60">Active pipeline & revenue signals</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
              <dt className="text-white/55">Active leads</dt>
              <dd className="font-semibold tabular-nums text-white">{dashboard?.analytics?.leads ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
              <dt className="text-white/55">Deals in closing</dt>
              <dd className="font-semibold tabular-nums text-white">
                {dashboard
                  ? countForStages(dashboard.pipeline, [
                      LeadStatus.NEGOTIATION,
                      LeadStatus.PROPOSAL_SENT,
                      LeadStatus.PROPOSAL_WON,
                    ])
                  : 0}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/55">Expected revenue</dt>
              <dd className="font-semibold tabular-nums text-emerald-200/90">
                {formatInr(revB?.expectedClosures ?? 0)}
              </dd>
            </div>
          </dl>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={card}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-white">Pipeline preview</h3>
              <p className="mt-1 text-sm text-white/60">New → Site → Quote → Close</p>
            </div>
            <Link href="/bgos/sales" className="text-xs font-semibold text-indigo-300 hover:text-indigo-200">
              Open
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {miniPipeline.map((col) => (
              <div
                key={col.key}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center"
              >
                <p className="text-lg font-semibold tabular-nums text-white">{col.count}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/45">{col.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={card}>
          <h3 className="text-xl font-semibold text-white">Inventory health</h3>
          <p className="mt-1 text-sm text-white/60">Stock & capacity</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li className="flex justify-between gap-2">
              <span className="text-white/55">Units on hand</span>
              <span className="font-medium tabular-nums">{inv?.totalUnits ?? 0}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-white/55">SKU count</span>
              <span className="font-medium tabular-nums">{inv?.products ?? 0}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-white/55">Low stock alerts</span>
              <span className="font-medium text-amber-200/90">{inv?.lowStockItems ?? 0}</span>
            </li>
          </ul>
          {(inv?.lowStockItems ?? 0) > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              ⚠ Review stock before scheduling more installs.
            </p>
          ) : null}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={card}>
          <h3 className="text-xl font-semibold text-white">Installation status</h3>
          <p className="mt-1 text-sm text-white/60">Field execution</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/55">Pending</dt>
              <dd className="font-semibold text-white">{(ops?.installationQueue ?? 0) + (ops?.pendingSiteVisits ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/55">In progress</dt>
              <dd className="font-semibold text-white">{ops?.installationsInProgress ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/55">Completed (all-time)</dt>
              <dd className="font-semibold text-white">{dashboard?.installations ?? 0}</dd>
            </div>
          </dl>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className={card}>
          <h3 className="text-xl font-semibold text-white">Team performance</h3>
          <p className="mt-1 text-sm text-white/60">Momentum & targets</p>
          {topTeam ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-white/80">
                Top performer: <span className="font-semibold text-white">{topTeam.name}</span> ({topTeam.wonLeads} wins)
              </p>
              <p className="text-white/55">
                Target completion:{" "}
                <span className="font-semibold text-indigo-200/90">{health?.teamProductivity ?? 0}%</span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/50">Invite your team to see rankings here.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={card}>
          <h3 className="text-xl font-semibold text-white">Financial snapshot</h3>
          <p className="mt-1 text-sm text-white/60">This month</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/55">Revenue</dt>
              <dd className="font-semibold text-emerald-200/95">{formatInr(fin?.monthlyRevenue ?? dashboard?.analytics?.revenue ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/55">Expenses</dt>
              <dd className="font-semibold text-white">{formatInr(fin?.currentMonthExpenses ?? dashboard?.analytics?.expenses ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/55">Profit</dt>
              <dd className="font-semibold text-white">{formatInr(fin?.netProfit ?? 0)}</dd>
            </div>
          </dl>
        </motion.div>
      </div>

      {!trialReadOnly ? (
        <Link
          href="/bgos/nexa"
          className="fixed bottom-6 right-5 z-40 flex items-center gap-2 rounded-full border border-indigo-400/30 bg-gradient-to-r from-indigo-600/90 to-violet-700/90 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_-8px_rgba(99,102,241,0.55)] backdrop-blur-md transition hover:scale-[1.03]"
        >
          <span aria-hidden>💬</span> Ask Nexa
        </Link>
      ) : null}
    </div>
  );
}
