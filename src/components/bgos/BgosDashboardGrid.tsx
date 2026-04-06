"use client";

import { UserRole } from "@prisma/client";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { BgosAddEmployeeForm } from "./BgosAddEmployeeForm";
import { BgosLeadsAssignmentPanel } from "./BgosLeadsAssignmentPanel";
import { BgosPipelineBoard } from "./BgosPipelineBoard";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BgosShineButton } from "./BgosShineButton";
import { SalesBoosterModule } from "./SalesBoosterModule";
import { BGOS_GRID_GAP, BGOS_MAIN_PAD } from "./layoutTokens";
import { easePremium, fadeUp, sectionReveal, staggerRow } from "./motion";
import type {
  DashboardHealth,
  NexaInsight,
  NexaSnapshot,
  TeamMemberPerformance,
} from "@/types";
import type { DashboardPayload } from "./useBgosData";

const METRIC_LABELS = [
  "Total leads",
  "Total revenue (won)",
  "Installations done",
  "Pending payments",
] as const;

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BgosDashboardGrid({
  dashboard,
  metricsUnavailable,
}: {
  dashboard: DashboardPayload | null;
  metricsUnavailable: boolean;
}) {
  const { sessionRole, planLockedToBasic } = useBgosDashboardContext();
  const isAdmin = sessionRole === UserRole.ADMIN;

  const metrics = useMemo(() => {
    if (!dashboard) return null;
    return [
      { label: METRIC_LABELS[0], value: String(dashboard.leads) },
      { label: METRIC_LABELS[1], value: formatInr(dashboard.revenue) },
      { label: METRIC_LABELS[2], value: String(dashboard.installations) },
      { label: METRIC_LABELS[3], value: String(dashboard.pendingPayments) },
    ];
  }, [dashboard]);

  const displayMetrics =
    metrics ??
    (metricsUnavailable
      ? METRIC_LABELS.map((label) => ({ label, value: "—" }))
      : null);

  return (
    <motion.div
      className={`grid grid-cols-1 pb-12 pt-4 md:grid-cols-2 lg:grid-cols-3 ${BGOS_GRID_GAP} ${BGOS_MAIN_PAD}`}
      variants={sectionReveal}
      initial="hidden"
      animate="show"
    >
      {/* 1 — Top metrics */}
      <motion.section
        id="overview"
        variants={fadeUp}
        className={`col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${BGOS_GRID_GAP}`}
        style={{ scrollMarginTop: "5.5rem" }}
      >
        {metricsUnavailable ? (
          <p className="col-span-full text-sm text-[#FF3B3B]/85" role="alert">
            Metrics unavailable — check database connection.
          </p>
        ) : null}
        {displayMetrics?.map((m) => (
          <motion.div key={m.label} variants={fadeUp}>
            <DashboardSurface className="p-5 sm:p-6">
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-white shadow-[0_0_24px_rgba(255,59,59,0.08)] sm:text-3xl lg:text-4xl">
                {m.value}
              </p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-white/45 sm:text-xs">
                {m.label}
              </p>
            </DashboardSurface>
          </motion.div>
        ))}
      </motion.section>

      <DashboardControlsStrip isAdmin={isAdmin} />

      {/* 2 — NEXA priority + health */}
      <NexaPriorityPanel
        nexa={dashboard?.nexa}
        insights={dashboard?.insights ?? []}
      />
      <BusinessHealthPanel health={dashboard?.health} />

      {/* 3 — Pipeline Kanban */}
      <BgosPipelineBoard />

      {/* 3b — Leads list + admin assignment */}
      <BgosLeadsAssignmentPanel isAdmin={isAdmin} />

      {/* 4 — Sales booster (hidden when deployment locks plan to BASIC) */}
      {!planLockedToBasic ? (
        <SalesBoosterModule
          salesBooster={dashboard?.salesBooster}
          hasDashboard={dashboard !== null}
        />
      ) : null}

      {/* 5 — Operations */}
      <OperationsPanel operations={dashboard?.operations} />

      {/* 6 — Team */}
      <TeamPanel team={dashboard?.team ?? []} isAdmin={isAdmin} />

      {/* 7 — Revenue */}
      <RevenuePanel
        breakdown={dashboard?.revenueBreakdown}
        pendingPaymentCount={dashboard?.pendingPayments}
      />

      {/* 8 — Risks */}
      <RisksPanel
        risks={dashboard?.risks}
        opportunitiesCount={dashboard?.nexa?.opportunities}
        pipelineValue={dashboard?.revenueBreakdown?.pipelineValue}
      />

      {/* 9 — NEXA chat */}
      <NexaChatPanel nexa={dashboard?.nexa} insights={dashboard?.insights ?? []} />
    </motion.div>
  );
}

function DashboardControlsStrip({ isAdmin }: { isAdmin: boolean }) {
  return (
    <motion.section
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface tilt={false} className="p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Control panel
        </h2>
        <p className="mt-1 text-xs text-white/35">
          Live metrics refresh automatically while this tab stays open.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href="#team"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:border-[#FFC300]/40"
          >
            View team performance
          </a>
          {isAdmin ? (
            <a
              href="#add-employee"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 text-sm font-semibold text-[#FFC300] transition hover:bg-[#FFC300]/15"
            >
              Add employee
            </a>
          ) : null}
          <Link
            href="/bgos/nexa"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white/90 transition hover:border-[#FFC300]/40"
          >
            Nexa focus view
          </Link>
        </div>
        {!isAdmin ? (
          <p className="mt-3 text-xs text-white/40">
            Only a company admin can add employees from this panel.
          </p>
        ) : null}
      </DashboardSurface>
    </motion.section>
  );
}

function insightDotClass(severity: NexaInsight["severity"]) {
  switch (severity) {
    case "alert":
      return "bg-[#FF3B3B]";
    case "warning":
      return "bg-[#FFC300]";
    default:
      return "bg-white/45";
  }
}

function formatInsightLine(insight: NexaInsight): string {
  const { message, meta } = insight;
  if (meta?.pendingTasks != null) {
    return `${message} (${meta.pendingTasks} pending)`;
  }
  if (meta?.overdueFollowUps != null) {
    return `${message} (${meta.overdueFollowUps} overdue)`;
  }
  if (meta?.delays != null) {
    return `${message} (${meta.delays} past schedule)`;
  }
  if (meta?.opportunities != null) {
    return `${message} (${meta.opportunities} in qualified → negotiation)`;
  }
  if (meta?.leads != null) {
    return `${message} (${meta.leads} leads)`;
  }
  if (meta?.wonLeads != null && meta?.lostLeads != null) {
    return `${message} (${meta.wonLeads} won / ${meta.lostLeads} lost)`;
  }
  return message;
}

function NexaPriorityPanel({
  nexa,
  insights,
}: {
  nexa: NexaSnapshot | undefined;
  insights: NexaInsight[];
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      variants={fadeUp}
      className="col-span-full lg:col-span-2"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <motion.div
        className="relative rounded-xl p-px"
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  "0 0 24px rgba(255,59,59,0.12), 0 0 40px rgba(255,195,0,0.06)",
                  "0 0 32px rgba(255,195,0,0.14), 0 0 48px rgba(255,59,59,0.1)",
                  "0 0 24px rgba(255,59,59,0.12), 0 0 40px rgba(255,195,0,0.06)",
                ],
              }
        }
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <DashboardSurface className="relative overflow-hidden !rounded-[11px] p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            aria-hidden
          >
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#FF3B3B]/20 blur-3xl" />
            <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-[#FFC300]/15 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Nexa insights
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Follow-ups, delays, and opportunities — driven by your live CRM data.
            </p>
            {nexa ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Pending follow-ups
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {nexa.pendingFollowUps}
                  </p>
                  {nexa.overdueFollowUps > 0 ? (
                    <p className="mt-0.5 text-xs text-amber-200/90">
                      {nexa.overdueFollowUps} overdue
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Delays
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {nexa.delays}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/40">Installs past due date</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Opportunities
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#FFE066]">
                    {nexa.opportunities}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    Leads in qualified, proposal, or negotiation
                  </p>
                </div>
              </div>
            ) : null}
            {insights.length > 0 ? (
              <ul className="mt-5 space-y-2.5 text-sm text-white/80 sm:mt-6 sm:text-base">
                {insights.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${insightDotClass(it.severity)}`}
                    />
                    <span>{formatInsightLine(it)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-white/60 sm:mt-6 sm:text-base">
                All clear — NEXA has no rule-based alerts for this company right now.
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#operations"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500/15"
              >
                Jump to operations
              </a>
              <a
                href="#sales"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#FFC300]/40 bg-[#FFC300]/10 px-4 text-sm font-semibold text-[#FFC300] transition hover:bg-[#FFC300]/15"
              >
                Review pipeline
              </a>
            </div>
          </div>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}

function BusinessHealthPanel({ health }: { health: DashboardHealth | undefined }) {
  const reduceMotion = useReducedMotion();
  const rows = [
    {
      label: "Follow-up efficiency",
      sub: "Share of pending tasks that are not overdue",
      value: health?.efficiency ?? 0,
    },
    {
      label: "Win rate",
      sub: "Won ÷ (won + lost)",
      value: health?.conversion ?? 0,
    },
    {
      label: "Task throughput",
      sub: "Completed ÷ all lead tasks",
      value: health?.teamProductivity ?? 0,
    },
  ];

  return (
    <motion.section variants={fadeUp} style={{ scrollMarginTop: "5.5rem" }}>
      <DashboardSurface className="p-6 sm:p-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Business health
        </h2>
        <p className="mt-1 text-[10px] text-white/35">Computed from live tasks, leads, and outcomes.</p>
        <div className="mt-5 space-y-5">
          {rows.map((row, i) => (
            <div key={row.label}>
              <div className="mb-1.5 flex justify-between gap-2 text-sm">
                <span className="text-white/70">
                  {row.label}
                  <span className="mt-0.5 block text-[10px] font-normal text-white/35">
                    {row.sub}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-white">{row.value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF3B3B] to-[#FFC300]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, row.value)}%` }}
                  transition={{
                    duration: reduceMotion ? 0 : 1,
                    delay: reduceMotion ? 0 : 0.2 + i * 0.1,
                    ease: easePremium,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </DashboardSurface>
    </motion.section>
  );
}

function OperationsPanel({
  operations,
}: {
  operations: DashboardPayload["operations"] | undefined;
}) {
  const q = operations?.installationQueue ?? 0;
  const svc = operations?.openServiceTickets ?? 0;
  const pend = operations?.pendingPayments ?? 0;

  const modules = [
    { label: "Installation queue", value: q },
    { label: "Open service tickets", value: svc },
    { label: "Pending payment records", value: pend },
  ];

  return (
    <motion.section
      id="operations"
      variants={staggerRow}
      className={`col-span-full grid grid-cols-1 sm:grid-cols-3 ${BGOS_GRID_GAP}`}
      style={{ scrollMarginTop: "5.5rem" }}
    >
      {modules.map((m) => (
        <motion.div key={m.label} variants={fadeUp}>
          <DashboardSurface className="p-4 sm:p-5">
            <p className="text-2xl font-semibold tabular-nums text-white">{m.value}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/45">
              {m.label}
            </p>
          </DashboardSurface>
        </motion.div>
      ))}
    </motion.section>
  );
}

function TeamPanel({
  team,
  isAdmin,
}: {
  team: TeamMemberPerformance[];
  isAdmin: boolean;
}) {
  return (
    <motion.section
      id="team"
      variants={staggerRow}
      className={`col-span-full space-y-6 ${BGOS_GRID_GAP}`}
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <motion.div variants={fadeUp}>
        <DashboardSurface className="overflow-x-auto p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white sm:text-base" id="team-performance">
            Team performance
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Assigned leads, wins, and pending tasks per person — updates with the rest of the dashboard.
          </p>
          {team.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">No active users in this company.</p>
          ) : (
            <table className="mt-4 w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/45">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Assigned</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Won</th>
                  <th className="pb-2 font-medium tabular-nums">Pending tasks</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.userId} className="border-b border-white/[0.06] text-white/88">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-white">{m.name}</span>
                      <span className="mt-0.5 block text-xs text-white/40">{m.email}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-white/60">{m.role}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{m.assignedLeads}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-emerald-200/90">{m.wonLeads}</td>
                    <td className="py-2.5 tabular-nums text-amber-200/90">{m.pendingTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DashboardSurface>
      </motion.div>

      {isAdmin ? (
        <motion.div variants={fadeUp} id="add-employee">
          <DashboardSurface className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white sm:text-base">Add employee</h2>
            <p className="mt-1 text-xs text-white/45">
              Creates a login for your company. Share credentials securely with the new hire.
            </p>
            <BgosAddEmployeeForm />
          </DashboardSurface>
        </motion.div>
      ) : null}
    </motion.section>
  );
}

function RevenuePanel({
  breakdown,
  pendingPaymentCount,
}: {
  breakdown: DashboardPayload["revenueBreakdown"] | undefined;
  pendingPaymentCount: number | undefined;
}) {
  const b = breakdown;
  const metrics = [
    {
      label: "Revenue (MTD)",
      sub: "Won deals closed this month",
      value: formatInr(b?.monthlyWon ?? 0),
    },
    {
      label: "Pipeline value",
      sub: "Open leads (not won/lost)",
      value: formatInr(b?.pipelineValue ?? 0),
    },
    {
      label: "Late-stage leads",
      sub: "Proposal + negotiation",
      value: String(b?.expectedClosures ?? 0),
    },
    {
      label: "Pending payments",
      sub:
        pendingPaymentCount != null
          ? `${pendingPaymentCount} open record${pendingPaymentCount === 1 ? "" : "s"}`
          : "Awaiting settlement",
      value: formatInr(b?.pendingAmount ?? 0),
    },
  ];

  const maxBar = Math.max(1, b?.monthlyWon ?? 0, b?.pipelineValue ?? 0);
  const wonPct = ((b?.monthlyWon ?? 0) / maxBar) * 100;
  const pipePct = ((b?.pipelineValue ?? 0) / maxBar) * 100;

  return (
    <motion.section
      id="revenue"
      variants={staggerRow}
      className={`col-span-full space-y-6`}
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <div className={`grid grid-cols-2 lg:grid-cols-4 ${BGOS_GRID_GAP}`}>
        {metrics.map((m) => (
          <motion.div key={m.label} variants={fadeUp}>
            <DashboardSurface className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {m.label}
              </p>
              <p className="text-[10px] text-white/35">{m.sub}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-white sm:text-2xl">
                {m.value}
              </p>
            </DashboardSurface>
          </motion.div>
        ))}
      </div>
      <motion.div variants={fadeUp}>
        <DashboardSurface className="p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/45">
            MTD won vs open pipeline
          </p>
          <p className="text-[10px] text-white/35">Normalized to the larger of the two figures</p>
          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>Month-to-date won</span>
                <span className="tabular-nums">{formatInr(b?.monthlyWon ?? 0)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF3B3B] to-[#FFC300]"
                  style={{ width: `${wonPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>Open pipeline value</span>
                <span className="tabular-nums">{formatInr(b?.pipelineValue ?? 0)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-white/25 to-white/50"
                  style={{ width: `${pipePct}%` }}
                />
              </div>
            </div>
          </div>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}

function RisksPanel({
  risks,
  opportunitiesCount,
  pipelineValue,
}: {
  risks: DashboardPayload["risks"] | undefined;
  opportunitiesCount: number | undefined;
  pipelineValue: number | undefined;
}) {
  const r = risks;

  const riskRows = [
    { label: "Lost leads", value: r?.lostLeads ?? 0 },
    { label: "Installations past schedule", value: r?.delays ?? 0 },
    { label: "Open service tickets", value: r?.openServiceTickets ?? 0 },
  ];

  const oppRows = [
    { label: "Active opportunities", value: String(opportunitiesCount ?? 0) },
    { label: "Open pipeline value", value: formatInr(pipelineValue ?? 0) },
  ];

  return (
    <motion.section
      id="risks"
      variants={fadeUp}
      className={`col-span-full grid grid-cols-1 md:grid-cols-2 ${BGOS_GRID_GAP}`}
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface className="border-red-500/30 !bg-red-500/[0.05] p-6 ring-1 ring-red-500/15">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300/90">
          Risks
        </h2>
        <ul className="mt-4 space-y-3">
          {riskRows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between border-b border-red-500/15 py-2 last:border-0"
            >
              <span className="text-sm text-white/85">{row.label}</span>
              <span className="text-lg font-semibold tabular-nums text-red-200">{row.value}</span>
            </li>
          ))}
        </ul>
      </DashboardSurface>
      <DashboardSurface className="!border-[#FFC300]/40 !bg-[#FFC300]/[0.06] p-6 ring-1 ring-[#FFC300]/20">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
          Opportunities
        </h2>
        <ul className="mt-4 space-y-3">
          {oppRows.map((o) => (
            <li
              key={o.label}
              className="flex items-center justify-between border-b border-[#FFC300]/20 py-2 last:border-0"
            >
              <span className="text-sm text-white/85">{o.label}</span>
              <span className="max-w-[55%] text-right text-lg font-semibold tabular-nums text-[#FFE066]">
                {o.value}
              </span>
            </li>
          ))}
        </ul>
      </DashboardSurface>
    </motion.section>
  );
}

function buildNexaBrief(nexa: NexaSnapshot | undefined, insights: NexaInsight[]): string {
  if (!nexa && insights.length === 0) {
    return "NEXA is synced with your workspace. No critical signals at this moment.";
  }
  const parts: string[] = [];
  if (nexa) {
    parts.push(
      `${nexa.pendingFollowUps} pending follow-up${nexa.pendingFollowUps === 1 ? "" : "s"}`,
    );
    if (nexa.overdueFollowUps > 0) {
      parts.push(`${nexa.overdueFollowUps} overdue`);
    }
    if (nexa.delays > 0) {
      parts.push(`${nexa.delays} installation${nexa.delays === 1 ? "" : "s"} past schedule`);
    }
    parts.push(`${nexa.opportunities} opportunity lead${nexa.opportunities === 1 ? "" : "s"}`);
  }
  const top = insights[0] ? formatInsightLine(insights[0]) : "";
  return `Live snapshot: ${parts.join(" · ")}.${top ? ` Top signal: ${top}` : ""}`;
}

function NexaChatPanel({
  nexa,
  insights,
}: {
  nexa: NexaSnapshot | undefined;
  insights: NexaInsight[];
}) {
  const reduceMotion = useReducedMotion();
  const brief = useMemo(() => buildNexaBrief(nexa, insights), [nexa, insights]);
  const [reply, setReply] = useState(brief);
  useEffect(() => {
    setReply(brief);
  }, [brief]);

  return (
    <motion.section
      id="nexa"
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <motion.div
        className="rounded-xl p-px"
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  "0 0 0 1px rgba(255,195,0,0.12), 0 0 28px rgba(255,59,59,0.08)",
                  "0 0 0 1px rgba(255,195,0,0.28), 0 0 40px rgba(255,59,59,0.12)",
                  "0 0 0 1px rgba(255,195,0,0.12), 0 0 28px rgba(255,59,59,0.08)",
                ],
              }
        }
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <DashboardSurface tilt={false} className="!rounded-[11px] p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
            NEXA Control Panel
          </p>
          <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/30 px-4 py-3">
            <p className="text-sm text-white/85">{reply}</p>
          </div>
          <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Quick actions
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() =>
                setReply(
                  nexa
                    ? `Prioritize ${nexa.overdueFollowUps} overdue follow-ups first, then ${Math.max(0, nexa.pendingFollowUps - nexa.overdueFollowUps)} remaining.`
                    : "Open the pipeline section to prioritize follow-ups.",
                )
              }
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-white/85 transition-colors hover:border-[#FFC300]/35 hover:bg-white/[0.07] sm:text-sm"
            >
              Triage follow-ups
            </button>
            <button
              type="button"
              onClick={() =>
                setReply(
                  nexa
                    ? `${nexa.opportunities} leads are in qualified / proposal / negotiation — align owners this week.`
                    : "Review opportunities in the risks panel.",
                )
              }
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-white/85 transition-colors hover:border-[#FFC300]/35 hover:bg-white/[0.07] sm:text-sm"
            >
              Focus opportunities
            </button>
          </div>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              setReply(
                "NEXA rules engine is live; full natural-language answers will ship in a later release. Use the metrics above for decisions.",
              );
            }}
          >
            <input
              name="q"
              placeholder="Ask Nexa anything..."
              className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#FFC300]/35"
            />
            <BgosShineButton type="submit" variant="duo" className="rounded-lg px-5">
              Send
            </BgosShineButton>
          </form>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}
