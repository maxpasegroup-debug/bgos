"use client";


import { apiFetch } from "@/lib/api-fetch";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { normalizeFinancialOverview } from "@/lib/dashboard-client-defaults";
import type {
  DashboardAnalytics,
  DashboardAnalyticsRangeMeta,
  DashboardMetrics,
  NexaInsight,
} from "@/types";
import { DashboardSurface } from "./DashboardSurface";

function insightDotClass(severity: NexaInsight["severity"]) {
  switch (severity) {
    case "alert":
      return "bg-[#FF3B3B]";
    case "warning":
      return "bg-[#FFC300]";
    default:
      return "bg-white/50";
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

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.065,
      delayChildren: 0.02,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.4, 0, 0.2, 1] },
  },
};

const metricLabels = [
  "Leads Today",
  "Revenue Today",
  "Installations Done",
  "Pending Approvals",
] as const;

const emptyAnalytics = (): DashboardAnalytics => ({
  revenue: 0,
  leads: 0,
  conversionPercent: 0,
  expenses: 0,
  trend: [],
});

const emptyAnalyticsRange = (): DashboardAnalyticsRangeMeta => ({
  preset: "this_month",
  from: "",
  to: "",
  label: "This Month",
});

function MetricCardSkeleton() {
  return (
    <DashboardSurface className="p-6">
      <div
        className="h-9 max-w-[7rem] animate-pulse rounded-lg bg-white/10 sm:h-10 sm:max-w-[9rem]"
        aria-hidden
      />
      <div
        className="mt-4 h-3 max-w-[5.5rem] animate-pulse rounded-md bg-white/[0.08]"
        aria-hidden
      />
      <div
        className="mt-2 h-3 max-w-[7rem] animate-pulse rounded-md bg-white/[0.06]"
        aria-hidden
      />
    </DashboardSurface>
  );
}

export function CommandCenterSection() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nexaControls, setNexaControls] = useState<{
    enabled: boolean;
    autonomyLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
    autoAssignLeads: boolean;
    autoReminders: boolean;
    autoTaskCreation: boolean;
  } | null>(null);
  const [nexaActions, setNexaActions] = useState<Array<{ id: string; message: string; status: string }>>([]);
  const [growth, setGrowth] = useState<{
    growth?: {
      growthState: string;
      dailyLoop: string;
      streakDays: number;
      weeklyScore: number;
      monthlyLevel: number;
      metrics: { leadsAddedToday: number; conversionRate: number; onboardingCountWeek: number; revenueThisMonth: number };
      targets: { dailyLeads: number; weeklyOnboarding: number; monthlyOnboarding: number };
      actions: Array<{ id: string; message: string; ctaLabel: string; ctaHref: string }>;
      funnel: { leads: number; demo: number; followUp: number; onboarding: number; subscription: number };
    };
  } | null>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const fetchData = () => {
      apiFetch("/api/dashboard", { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Request failed");
          return res.json();
        })
        .then((json: DashboardMetrics) => {
          setData({
            ...json,
            insights: Array.isArray(json.insights) ? json.insights : [],
            pipeline: Array.isArray(json.pipeline) ? json.pipeline : [],
            salesBooster:
              json.salesBooster ?? {
                plan: "BASIC",
                featuresUnlocked: false,
                companyName: "",
              },
            automationCenter: json.automationCenter ?? null,
            financial: normalizeFinancialOverview(json.financial),
            analytics: json.analytics ?? emptyAnalytics(),
            analyticsRange: json.analyticsRange ?? emptyAnalyticsRange(),
          });
          setLoadError(null);
          hasLoadedOnce.current = true;
        })
        .catch(() => {
          if (!hasLoadedOnce.current) {
            setLoadError("Could not load metrics");
          }
        });
    };

    const fetchNexaControls = () => {
      apiFetch("/api/automation/settings", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => {
          if (!j?.ok) return;
          setNexaControls({
            enabled: Boolean(j.enabled),
            autonomyLevel: (j.autonomyLevel as "LEVEL_1" | "LEVEL_2" | "LEVEL_3") ?? "LEVEL_2",
            autoAssignLeads: Boolean(j.autoAssignLeads),
            autoReminders: Boolean(j.autoReminders),
            autoTaskCreation: Boolean(j.autoTaskCreation),
          });
        })
        .catch(() => {});
    };
    const fetchNexaActions = () => {
      apiFetch("/api/nexa/actions", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => {
          if (!j?.ok) return;
          const rows = Array.isArray(j.actions) ? j.actions : [];
          setNexaActions(
            rows
              .slice(0, 5)
              .map((r: { id?: string; message?: string; status?: string }) => ({
                id: String(r.id),
                message: String(r.message),
                status: String(r.status),
              })),
          );
        })
        .catch(() => {});
    };
    const fetchNexaGrowth = () => {
      apiFetch("/api/nexa/growth", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => {
          if (!j?.ok || !j.growth || typeof j.growth !== "object") return;
          const g = j.growth as {
            growthState: string;
            dailyLoop: string;
            streakDays: number;
            weeklyScore: number;
            monthlyLevel: number;
            metrics: { leadsAddedToday: number; conversionRate: number; onboardingCountWeek: number; revenueThisMonth: number };
            targets: { dailyLeads: number; weeklyOnboarding: number; monthlyOnboarding: number };
            actions: Array<{ id: string; message: string; ctaLabel: string; ctaHref: string }>;
            funnel: { leads: number; demo: number; followUp: number; onboarding: number; subscription: number };
          };
          setGrowth({ growth: g });
        })
        .catch(() => {});
    };

    fetchData();
    fetchNexaControls();
    fetchNexaActions();
    fetchNexaGrowth();
    const intervalId = window.setInterval(fetchData, 4000);
    const nexaId = window.setInterval(fetchNexaActions, 20000);
    const growthId = window.setInterval(fetchNexaGrowth, 25000);
    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(nexaId);
      window.clearInterval(growthId);
    };
  }, []);

  const patchControl = async (
    key: "autoAssignLeads" | "autoReminders" | "autoTaskCreation",
    value: boolean,
  ) => {
    const prev = nexaControls;
    if (!prev) return;
    setNexaControls({ ...prev, [key]: value });
    try {
      await apiFetch("/api/automation/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      setNexaControls(prev);
    }
  };

  const topMetrics =
    data !== null
      ? [
          { label: metricLabels[0], value: String(data.leads) },
          { label: metricLabels[1], value: formatInr(data.revenue) },
          { label: metricLabels[2], value: String(data.installations) },
          { label: metricLabels[3], value: String(data.pendingPayments) },
        ]
      : [
          { label: metricLabels[0], value: "—" },
          { label: metricLabels[1], value: "—" },
          { label: metricLabels[2], value: "—" },
          { label: metricLabels[3], value: "—" },
        ];

  return (
    <motion.div
      className="flex flex-col gap-7 pb-11 pt-9 sm:gap-8 sm:pb-14 sm:pt-11"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      <motion.h2
        variants={itemVariants}
        className="text-lg font-semibold tracking-tight text-white/90 sm:text-xl"
      >
        Command Center
      </motion.h2>

      {loadError !== null ? (
        <motion.p
          variants={itemVariants}
          className="text-sm text-[#FF3B3B]/90"
          role="alert"
        >
          {loadError}
        </motion.p>
      ) : null}

      {data === null && loadError === null ? (
        <span className="sr-only">Loading dashboard metrics</span>
      ) : null}

      <motion.div
        variants={rowVariants}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
        aria-busy={data === null && loadError === null}
      >
        {data === null && loadError === null
          ? [0, 1, 2, 3].map((i) => (
              <motion.div
                key={`sk-${i}`}
                variants={itemVariants}
                className="h-full"
              >
                <MetricCardSkeleton />
              </motion.div>
            ))
          : topMetrics.map((m) => (
              <motion.div key={m.label} variants={itemVariants} className="h-full">
                <DashboardSurface className="p-6">
                  <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    {m.value}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-white/45">
                    {m.label}
                  </p>
                </DashboardSurface>
              </motion.div>
            ))}
      </motion.div>

      {data !== null && data.pipeline.length > 0 ? (
        <motion.div variants={rowVariants}>
          <DashboardSurface className="p-5 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Pipeline
            </h3>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {data.pipeline.map((s) => (
                <div
                  key={s.stage}
                  className="flex min-w-[4.5rem] shrink-0 flex-col rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <p className="text-xl font-semibold tabular-nums text-white">{s.count}</p>
                  <p className="mt-1 text-[9px] font-medium uppercase leading-tight tracking-wide text-white/45">
                    {s.stage}
                  </p>
                </div>
              ))}
            </div>
          </DashboardSurface>
        </motion.div>
      ) : null}

      <motion.div
        variants={rowVariants}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7"
      >
        <NexaMainCard
          data={data}
          metricsUnavailable={loadError !== null && data === null}
        />
        <HealthScoreCard />
      </motion.div>

      <motion.div variants={rowVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
        <motion.div variants={itemVariants}>
          <DashboardSurface className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Nexa Controls</h3>
            {nexaControls ? (
              <div className="mt-4 space-y-3 text-sm text-white/85">
                <ToggleRow
                  label="Auto assign leads"
                  checked={nexaControls.autoAssignLeads}
                  onChange={(v) => void patchControl("autoAssignLeads", v)}
                />
                <ToggleRow
                  label="Auto reminders"
                  checked={nexaControls.autoReminders}
                  onChange={(v) => void patchControl("autoReminders", v)}
                />
                <ToggleRow
                  label="Auto task creation"
                  checked={nexaControls.autoTaskCreation}
                  onChange={(v) => void patchControl("autoTaskCreation", v)}
                />
                <p className="text-xs text-white/50">
                  Autonomy level: {nexaControls.autonomyLevel.replace("_", " ")}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/55">Controls unavailable.</p>
            )}
          </DashboardSurface>
        </motion.div>

        <motion.div variants={itemVariants}>
          <DashboardSurface className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Nexa Activity Log</h3>
            {nexaActions.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                {nexaActions.map((a) => (
                  <li key={a.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="mr-2 text-[10px] font-semibold uppercase text-white/50">{a.status}</span>
                    {a.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-white/55">No Nexa actions yet.</p>
            )}
          </DashboardSurface>
        </motion.div>
      </motion.div>

      {growth?.growth ? (
        <motion.div variants={rowVariants}>
          <motion.div variants={itemVariants}>
            <DashboardSurface className="p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Nexa Growth Engine</h3>
              <p className="mt-3 text-sm text-white/85">{growth.growth.dailyLoop}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/75 sm:grid-cols-4">
                <div className="rounded border border-white/10 px-2 py-1">Leads Today: {growth.growth.metrics.leadsAddedToday}/{growth.growth.targets.dailyLeads}</div>
                <div className="rounded border border-white/10 px-2 py-1">Conversion: {growth.growth.metrics.conversionRate}%</div>
                <div className="rounded border border-white/10 px-2 py-1">Onboarding Week: {growth.growth.metrics.onboardingCountWeek}/{growth.growth.targets.weeklyOnboarding}</div>
                <div className="rounded border border-white/10 px-2 py-1">Revenue Month: {formatInr(growth.growth.metrics.revenueThisMonth)}</div>
              </div>
              <div className="mt-3 text-xs text-white/70">
                Funnel: {growth.growth.funnel.leads} {"->"} {growth.growth.funnel.demo} {"->"} {growth.growth.funnel.followUp} {"->"} {growth.growth.funnel.onboarding} {"->"} {growth.growth.funnel.subscription}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2 py-1">State: {growth.growth.growthState}</span>
                <span className="rounded-full bg-white/10 px-2 py-1">Streak: {growth.growth.streakDays} days</span>
                <span className="rounded-full bg-white/10 px-2 py-1">Weekly score: {growth.growth.weeklyScore}</span>
                <span className="rounded-full bg-white/10 px-2 py-1">Level: {growth.growth.monthlyLevel}</span>
              </div>
              {growth.growth.actions.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {growth.growth.actions.slice(0, 2).map((a) => (
                    <Link key={a.id} href={a.ctaHref} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                      {a.message} - {a.ctaLabel}
                    </Link>
                  ))}
                </div>
              ) : null}
            </DashboardSurface>
          </motion.div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}

function NexaMainCard({
  data,
  metricsUnavailable,
}: {
  data: DashboardMetrics | null;
  metricsUnavailable?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const insights = data?.insights ?? [];

  return (
    <motion.div variants={itemVariants} className="lg:col-span-2">
      <motion.div
        className="relative rounded-xl p-[1px]"
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  "0 0 24px rgba(255, 59, 59, 0.12), 0 0 48px rgba(255, 195, 0, 0.06), inset 0 0 0 1px rgba(255,255,255,0.06)",
                  "0 0 32px rgba(255, 195, 0, 0.14), 0 0 56px rgba(255, 59, 59, 0.1), inset 0 0 0 1px rgba(255,255,255,0.08)",
                  "0 0 24px rgba(255, 59, 59, 0.12), 0 0 48px rgba(255, 195, 0, 0.06), inset 0 0 0 1px rgba(255,255,255,0.06)",
                ],
              }
        }
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <DashboardSurface className="relative overflow-hidden !rounded-[11px] p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
          >
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#FF3B3B]/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#FFC300]/15 blur-3xl" />
          </div>

          <div className="relative">
            <h3 className="text-lg font-semibold leading-snug text-white sm:text-xl">
              Boss, here&apos;s what matters today:
            </h3>
            {metricsUnavailable ? (
              <p className="mt-6 text-sm text-white/55 sm:text-base">
                Insights will appear once dashboard data loads.
              </p>
            ) : data === null ? (
              <ul className="mt-6 space-y-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                    <span className="h-4 max-w-md flex-1 animate-pulse rounded bg-white/10" />
                  </li>
                ))}
              </ul>
            ) : insights.length > 0 ? (
              <ul className="mt-6 space-y-3 text-sm text-white/80 sm:text-base">
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
              <p className="mt-6 text-sm text-white/70 sm:text-base">
                All signals look steady — nothing urgent from NEXA right now.
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <motion.button
                type="button"
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.02,
                        boxShadow:
                          "0 0 28px rgba(255, 59, 59, 0.45), 0 0 50px rgba(255, 59, 59, 0.18)",
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#FF3B3B] to-[#e62e2e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[0_0_25px_rgba(255,59,59,0.25)]"
              >
                Fix Now
              </motion.button>
              <motion.button
                type="button"
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.02,
                        boxShadow:
                          "0 0 28px rgba(255, 195, 0, 0.4), 0 0 48px rgba(255, 195, 0, 0.12)",
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#FFC300] to-[#e6b008] px-6 py-3 text-sm font-semibold text-[#0B0F19] shadow-lg shadow-[#FFC300]/20"
              >
                Auto Handle
              </motion.button>
            </div>
          </div>
        </DashboardSurface>
      </motion.div>
    </motion.div>
  );
}

function HealthScoreCard() {
  const rows = [
    { label: "Business Efficiency", value: 82 },
    { label: "Conversion Rate", value: 34 },
    { label: "Team Productivity", value: 76 },
  ] as const;

  return (
    <motion.div variants={itemVariants} className="lg:col-span-1">
      <DashboardSurface className="p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
        Health score
      </h3>
      <div className="mt-6 space-y-6">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className="text-white/75">{row.label}</span>
              <span className="font-semibold tabular-nums text-white">
                {row.value}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#FF3B3B] to-[#FFC300]"
                initial={{ width: 0 }}
                animate={{ width: `${row.value}%` }}
                transition={{
                  duration: 1.2,
                  delay: 0.6 + i * 0.14,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      </DashboardSurface>
    </motion.div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`rounded-full px-2 py-1 text-xs font-semibold ${checked ? "bg-emerald-500/30 text-emerald-100" : "bg-white/10 text-white/70"}`}
      >
        {checked ? "ON" : "OFF"}
      </button>
    </label>
  );
}
