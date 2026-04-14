"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { IceconnectCustomerPlan } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { CUSTOMER_PLAN_LABEL } from "@/lib/iceconnect-sales-hub";
import { CircularProgressRing } from "./CircularProgressRing";
import { IceconnectManagerTargetsPanel } from "./IceconnectManagerTargetsPanel";

type DashboardJson = {
  ok?: boolean;
  period?: { year: number; month: number };
  target?: {
    targetCount: number;
    targetPlan: IceconnectCustomerPlan;
    salaryRupees: number;
  } | null;
  achieved?: number;
  progressPct?: number;
  eligibleSalaryRupees?: number;
  fullSalaryRupees?: number;
  metrics?: { leadsHandled: number; demosDone: number; conversions: number };
  nexaLines?: string[];
  todayActions?: {
    pendingFollowUps: { id: string; title: string; dueDate: string | null; lead: { name: string } | null }[];
    pendingTasks: { id: string; title: string; lead: { name: string } | null }[];
  };
  code?: string;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function IceconnectMyJourneyClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();
  const [data, setData] = useState<DashboardJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/iceconnect/executive/dashboard", { credentials: "include" });
      const j = (await res.json()) as DashboardJson;
      if (res.status === 403 && j.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(typeof (j as { error?: string }).error === "string" ? (j as { error: string }).error : "Could not load dashboard");
        return;
      }
      setData(j);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { role?: string } };
        if (c) return;
        const r = j.user?.role;
        setIsManager(r === "MANAGER" || r === "ADMIN");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (!ready || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">Loading your journey…</div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/90 p-6 text-center text-sm text-red-800">
        <p>{err}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const targetCount = data?.target?.targetCount ?? 0;
  const achieved = data?.achieved ?? 0;
  const progressPct = targetCount > 0 ? Math.min(100, Math.round((achieved / targetCount) * 100)) : (data?.progressPct ?? 0);
  const salary = data?.fullSalaryRupees ?? 0;
  const eligible = data?.eligibleSalaryRupees ?? 0;
  const salaryBarPct = salary > 0 ? Math.min(100, Math.round((eligible / salary) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Journey</h1>
        <p className="mt-1 text-sm text-gray-500">Target, salary, and what to do next</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Target progress</h2>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <CircularProgressRing
              percent={progressPct}
              label="Progress"
              sublabel={
                targetCount > 0
                  ? `${achieved} of ${targetCount} ${data?.target?.targetPlan ? CUSTOMER_PLAN_LABEL[data.target.targetPlan] : ""} conversions`
                  : "No monthly target set yet"
              }
            />
            <div className="text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-900">Target:</span>{" "}
                {targetCount > 0 ? `${targetCount} (${data?.target?.targetPlan ? CUSTOMER_PLAN_LABEL[data.target.targetPlan] : "—"})` : "—"}
              </p>
              <p className="mt-1">
                <span className="font-medium text-gray-900">Achieved:</span> {achieved}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Your current eligible salary</h2>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600">
            {formatInr(eligible)}
            <span className="text-lg font-normal text-gray-400"> / {formatInr(salary)}</span>
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
              initial={{ width: 0 }}
              animate={{ width: `${salaryBarPct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Eligible = (achieved ÷ target) × monthly salary when a target is set.
          </p>
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-800">Nexa assist</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-800">
          {(data?.nexaLines ?? []).map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-indigo-500">▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </motion.section>

      <div className="grid gap-6 sm:grid-cols-3">
        {(
          [
            ["Leads handled", data?.metrics?.leadsHandled ?? 0],
            ["Demos done", data?.metrics?.demosDone ?? 0],
            ["Conversions (month)", data?.metrics?.conversions ?? 0],
          ] as const
        ).map(([label, val], i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.04 }}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{val}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Today — follow-ups</h2>
          <ul className="mt-3 space-y-2">
            {(data?.todayActions?.pendingFollowUps ?? []).length === 0 ? (
              <li className="text-sm text-gray-500">No scheduled follow-ups.</li>
            ) : (
              (data?.todayActions?.pendingFollowUps ?? []).map((t) => (
                <li key={t.id} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{t.title}</span>
                  {t.lead ? <span className="text-gray-500"> · {t.lead.name}</span> : null}
                  {t.dueDate ? (
                    <span className="mt-0.5 block text-xs text-amber-700">
                      {new Date(t.dueDate).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Today — tasks</h2>
          <ul className="mt-3 space-y-2">
            {(data?.todayActions?.pendingTasks ?? []).length === 0 ? (
              <li className="text-sm text-gray-500">No open tasks.</li>
            ) : (
              (data?.todayActions?.pendingTasks ?? []).map((t) => (
                <li key={t.id} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{t.title}</span>
                  {t.lead ? <span className="text-gray-500"> · {t.lead.name}</span> : null}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {isManager ? (
        <div className="pt-4">
          <IceconnectManagerTargetsPanel />
        </div>
      ) : null}

      <p className="text-center text-xs text-gray-400">
        <Link href="/iceconnect/leads" className="font-medium text-indigo-600 hover:underline">
          Go to Leads
        </Link>
        {" · "}
        <Link href="/iceconnect/internal-sales" className="text-gray-500 hover:underline">
          Full internal pipeline
        </Link>
      </p>
    </div>
  );
}
