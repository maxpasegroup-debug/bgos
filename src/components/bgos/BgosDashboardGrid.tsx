"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { BgosShineButton } from "./BgosShineButton";
import { SalesBoosterModule } from "./SalesBoosterModule";
import { BGOS_GRID_GAP, BGOS_MAIN_PAD } from "./layoutTokens";
import { easePremium, fadeUp, sectionReveal, staggerRow } from "./motion";
import type { NexaInsight } from "@/types";
import type { DashboardPayload, PipelineRow } from "./useBgosData";

const METRIC_LABELS = [
  "Leads Today",
  "Revenue Today",
  "Installations Done",
  "Pending Approvals",
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
  pipeline,
  metricsUnavailable,
}: {
  dashboard: DashboardPayload | null;
  pipeline: PipelineRow[] | null;
  metricsUnavailable: boolean;
}) {
  const reduceMotion = useReducedMotion();

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

      {/* 2 — NEXA priority + health */}
      <NexaPriorityPanel insights={dashboard?.insights ?? []} />
      <BusinessHealthPanel />

      {/* 3 — Pipeline */}
      <PipelinePanel pipeline={pipeline} reduceMotion={!!reduceMotion} />

      {/* 4 — Sales booster */}
      <SalesBoosterModule
        salesBooster={dashboard?.salesBooster}
        hasDashboard={dashboard !== null}
      />

      {/* 5 — Operations */}
      <OperationsPanel />

      {/* 6 — Team */}
      <TeamPanel />

      {/* 7 — Revenue */}
      <RevenuePanel />

      {/* 8 — Risks */}
      <RisksPanel />

      {/* 9 — NEXA chat */}
      <NexaChatPanel />
    </motion.div>
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
  if (meta?.leads != null) {
    return `${message} (${meta.leads} leads)`;
  }
  if (meta?.wonLeads != null && meta?.lostLeads != null) {
    return `${message} (${meta.wonLeads} won / ${meta.lostLeads} lost)`;
  }
  return message;
}

function NexaPriorityPanel({ insights }: { insights: NexaInsight[] }) {
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
              Boss, here&apos;s what matters today:
            </h2>
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
                All clear — NEXA has no alerts for this company right now.
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <BgosShineButton variant="red">Fix Now</BgosShineButton>
              <BgosShineButton variant="yellow">Auto Handle</BgosShineButton>
            </div>
          </div>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}

function BusinessHealthPanel() {
  const rows = [
    { label: "Efficiency", value: 82 },
    { label: "Conversion", value: 34 },
    { label: "Team productivity", value: 76 },
  ];
  const reduceMotion = useReducedMotion();

  return (
    <motion.section variants={fadeUp} style={{ scrollMarginTop: "5.5rem" }}>
      <DashboardSurface className="p-6 sm:p-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Business health
        </h2>
        <div className="mt-5 space-y-5">
          {rows.map((row, i) => (
            <div key={row.label}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-white/70">{row.label}</span>
                <span className="tabular-nums font-medium text-white">
                  {row.value}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF3B3B] to-[#FFC300]"
                  initial={{ width: 0 }}
                  animate={{ width: `${row.value}%` }}
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

function PipelinePanel({
  pipeline,
  reduceMotion,
}: {
  pipeline: PipelineRow[] | null;
  reduceMotion: boolean;
}) {
  const stages = pipeline ?? [];

  return (
    <motion.section
      id="sales"
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface tilt={false} className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white sm:text-base">
          Sales pipeline
        </h2>
        <div className="relative mb-3 mt-4 hidden h-1 w-full overflow-hidden rounded-full bg-white/[0.07] md:block">
          <motion.div
            className="absolute inset-y-0 w-[28%] rounded-full bg-gradient-to-r from-transparent via-[#FFC300]/60 to-transparent"
            animate={reduceMotion ? undefined : { x: ["-100%", "320%"] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
        <div className="relative flex min-w-0 items-stretch gap-0 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
          {stages.length === 0
            ? [0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex shrink-0 items-stretch">
                  <div className="flex w-[5.5rem] flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:w-24">
                    <div className="h-6 w-8 animate-pulse rounded bg-white/10" />
                    <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                  </div>
                  {i < 6 ? (
                    <div className="flex w-5 shrink-0 items-center sm:w-6">
                      <div className="h-px w-full bg-white/15" />
                    </div>
                  ) : null}
                </div>
              ))
            : stages.map((s, i) => (
                <div key={s.stage} className="flex shrink-0 items-stretch">
                  <DashboardSurface className="flex w-[5.5rem] flex-col p-3 sm:w-[5.75rem]">
                    <p className="text-xl font-semibold tabular-nums text-white sm:text-2xl">
                      {s.count}
                    </p>
                    <p className="mt-1.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-white/45">
                      {s.stage}
                    </p>
                  </DashboardSurface>
                  {i < stages.length - 1 ? (
                    <div className="relative flex w-5 shrink-0 items-center self-center sm:w-6">
                      <div className="h-px w-full rounded-full bg-white/18" />
                    </div>
                  ) : null}
                </div>
              ))}
        </div>
      </DashboardSurface>
    </motion.section>
  );
}

function OperationsPanel() {
  const modules = [
    { label: "Loan Status", value: 9 },
    { label: "Installation Queue", value: 6 },
    { label: "Approval Status", value: 4 },
    { label: "Service Requests", value: 11 },
  ];

  return (
    <motion.section
      id="operations"
      variants={staggerRow}
      className={`col-span-full grid grid-cols-2 lg:grid-cols-4 ${BGOS_GRID_GAP}`}
      style={{ scrollMarginTop: "5.5rem" }}
    >
      {modules.map((m) => (
        <motion.div key={m.label} variants={fadeUp}>
          <DashboardSurface className="p-4 sm:p-5">
            <p className="text-2xl font-semibold tabular-nums text-white">
              {m.value}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/45">
              {m.label}
            </p>
          </DashboardSurface>
        </motion.div>
      ))}
      <motion.div variants={fadeUp} className="col-span-full">
        <DashboardSurface tilt={false} className="overflow-hidden p-0">
          <div
            className="h-0.5 w-full bg-gradient-to-r from-[#FF3B3B] to-[#FFC300]"
            aria-hidden
          />
          <p className="px-4 py-3.5 text-sm font-medium text-white/90 sm:px-5">
            2 installations delayed
          </p>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}

function TeamPanel() {
  const depts = [
    { name: "Marketing", pct: 91, bar: "from-emerald-400 to-green-500" },
    { name: "Installation", pct: 74, bar: "from-amber-400 to-[#FFC300]" },
    { name: "Service", pct: 61, bar: "from-[#FF3B3B] to-red-600" },
  ];
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="team"
      variants={staggerRow}
      className={`col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${BGOS_GRID_GAP}`}
      style={{ scrollMarginTop: "5.5rem" }}
    >
      {depts.map((d, i) => (
        <motion.div key={d.name} variants={fadeUp}>
          <DashboardSurface className="p-6">
            <h3 className="text-sm font-medium text-white">{d.name}</h3>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-white">
              {d.pct}
              <span className="text-lg text-white/45">%</span>
            </p>
            <p className="text-xs text-white/45">Performance</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${d.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${d.pct}%` }}
                transition={{
                  duration: reduceMotion ? 0 : 0.9,
                  delay: reduceMotion ? 0 : 0.15 + i * 0.08,
                  ease: easePremium,
                }}
              />
            </div>
          </DashboardSurface>
        </motion.div>
      ))}
    </motion.section>
  );
}

function RevenuePanel() {
  const metrics = [
    { label: "Monthly revenue", sub: "MTD", value: "₹3.18Cr" },
    { label: "Pipeline value", sub: "Open", value: "₹8.4Cr" },
    { label: "Expected closures", sub: "Quarter", value: "12" },
    { label: "Pending payments", sub: "Settlement", value: "₹42L" },
  ];

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
            Revenue trend
          </p>
          <p className="text-[10px] text-white/35">Placeholder</p>
          <div className="mt-4 flex h-36 items-end gap-1">
            {[40, 65, 52, 78, 58, 88, 70, 92].map((h, i) => (
              <div
                key={i}
                className="min-w-0 flex-1 rounded-t-sm bg-gradient-to-t from-[#FF3B3B]/80 to-[#FFC300]/70 opacity-90"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}

function RisksPanel() {
  const risks = [
    { label: "Lost leads", value: 7 },
    { label: "Delays", value: 2 },
    { label: "Complaints", value: 3 },
  ];
  const opps = [
    { label: "Hot leads", value: 14 },
    { label: "Upsells", value: 6 },
    { label: "Referrals", value: 9 },
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
          {risks.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between border-b border-red-500/15 py-2 last:border-0"
            >
              <span className="text-sm text-white/85">{r.label}</span>
              <span className="text-lg font-semibold tabular-nums text-red-200">
                {r.value}
              </span>
            </li>
          ))}
        </ul>
      </DashboardSurface>
      <DashboardSurface className="!border-[#FFC300]/40 !bg-[#FFC300]/[0.06] p-6 ring-1 ring-[#FFC300]/20">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
          Opportunities
        </h2>
        <ul className="mt-4 space-y-3">
          {opps.map((o) => (
            <li
              key={o.label}
              className="flex items-center justify-between border-b border-[#FFC300]/20 py-2 last:border-0"
            >
              <span className="text-sm text-white/85">{o.label}</span>
              <span className="text-lg font-semibold tabular-nums text-[#FFE066]">
                {o.value}
              </span>
            </li>
          ))}
        </ul>
      </DashboardSurface>
    </motion.section>
  );
}

function NexaChatPanel() {
  const [reply, setReply] = useState("Boss, 3 leads are ready to close.");
  const reduceMotion = useReducedMotion();

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
            {["Follow up all hot leads", "Optimize pipeline"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setReply("Boss, 3 leads are ready to close.")}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-white/85 transition-colors hover:border-[#FFC300]/35 hover:bg-white/[0.07] sm:text-sm"
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              setReply("Boss, 3 leads are ready to close.");
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
