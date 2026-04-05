"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DashboardMetrics, NexaInsight } from "@/types";
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
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const fetchData = () => {
      fetch("/api/dashboard", { credentials: "include" })
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

    fetchData();
    const intervalId = window.setInterval(fetchData, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

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
