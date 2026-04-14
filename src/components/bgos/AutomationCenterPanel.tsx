"use client";


import { apiFetch } from "@/lib/api-fetch";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import type { DashboardAutomationCenter } from "@/types";
import { fadeUp } from "./motion";

type ActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

async function patchAutomationEnabled(enabled: boolean): Promise<boolean> {
  const res = await apiFetch("/api/automation/settings", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const j = (await res.json()) as { ok?: boolean; enabled?: boolean; data?: { enabled?: boolean } };
  const ok = res.ok && j.ok === true;
  return ok;
}

async function fetchAutomationLogs(): Promise<ActivityRow[]> {
  const params = new URLSearchParams({
    types: "AUTOMATION_SIMULATED",
    limit: "25",
  });
  const res = await apiFetch(`/api/activity?${params}`, { credentials: "include" });
  if (!res.ok) return [];
  const j = (await res.json()) as {
    ok?: boolean;
    items?: ActivityRow[];
  };
  return Array.isArray(j.items) ? j.items : [];
}

export function AutomationCenterPanel({
  automation,
  canConfigure,
  onSettingsSaved,
}: {
  automation: DashboardAutomationCenter | null | undefined;
  canConfigure: boolean;
  onSettingsSaved?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [toggleBusy, setToggleBusy] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsBusy, setLogsBusy] = useState(false);
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLogsBusy(true);
    setLogsError(null);
    try {
      const rows = await fetchAutomationLogs();
      setLogs(rows);
    } catch {
      setLogsError("Could not load activity.");
      setLogs([]);
    } finally {
      setLogsBusy(false);
    }
  }, []);

  if (!automation) return null;

  const enabled = automation.enabled;

  return (
    <motion.section
      id="automation-center"
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface className="border border-[#FFC300]/15 bg-gradient-to-br from-[#FFC300]/[0.06] via-black/40 to-black/25 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]/90">
              Automation Center
            </p>
            <h2 className="mt-1 text-base font-semibold text-white sm:text-lg">
              {"Workflows & background actions"}
            </h2>
            <p className="mt-1 max-w-xl text-xs text-white/50">
              When off, NEXA auto-handle, Sales Booster on new leads, and database automation rules are
              paused. Nexa suggestions and manual actions still work.
            </p>
          </div>
          {canConfigure ? (
            <div className="flex flex-col items-end gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                Automation
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={toggleBusy}
                onClick={() => {
                  setToggleBusy(true);
                  void patchAutomationEnabled(!enabled).then((ok) => {
                    setToggleBusy(false);
                    if (ok) onSettingsSaved?.();
                  });
                }}
                className={`relative h-9 w-16 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                  enabled
                    ? "border-emerald-500/50 bg-emerald-500/20"
                    : "border-white/15 bg-white/[0.06]"
                }`}
              >
                <span
                  className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-md transition-transform ${
                    enabled ? "left-8" : "left-1"
                  }`}
                />
              </button>
              <span className={`text-[10px] font-semibold ${enabled ? "text-emerald-300" : "text-white/45"}`}>
                {toggleBusy ? "Saving…" : enabled ? "ON" : "OFF"}
              </span>
            </div>
          ) : (
            <span
              className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                enabled
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-white/20 bg-white/[0.06] text-white/50"
              }`}
            >
              {enabled ? "Automation on" : "Automation off"}
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Active flows</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{automation.activeFlows}</p>
            <p className="mt-0.5 text-[10px] text-white/45">Automation rules in your workspace</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Follow-ups pending
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#FFC300]">
              {automation.followUpsPending}
            </p>
            <p className="mt-0.5 text-[10px] text-white/45">Open tasks company-wide</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
              Nexa
            </p>
            {automation.nexaSuggestion ? (
              <p className="mt-1 text-sm font-medium text-white/90">{automation.nexaSuggestion}</p>
            ) : (
              <p className="mt-1 text-sm text-white/45">No follow-up backlog signal right now.</p>
            )}
            {automation.overdueFollowUps > 0 ? (
              <p className="mt-1 text-[10px] text-amber-200/80">
                {automation.overdueFollowUps} overdue
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={() => {
              const next = !logsOpen;
              setLogsOpen(next);
              if (next && logs.length === 0) void loadLogs();
            }}
            className="rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/85 transition hover:border-[#FFC300]/35 hover:bg-white/[0.08]"
          >
            {logsOpen ? "Hide logs" : "View logs"}
          </button>
          {logsOpen ? (
            <button
              type="button"
              disabled={logsBusy}
              onClick={() => void loadLogs()}
              className="text-xs font-medium text-[#FFC300] underline-offset-2 hover:underline disabled:opacity-50"
            >
              {logsBusy ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
        </div>

        {logsOpen ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/40"
          >
            {logsError ? (
              <p className="p-4 text-sm text-amber-200/90">{logsError}</p>
            ) : logs.length === 0 && !logsBusy ? (
              <p className="p-4 text-sm text-white/45">No automation activity logged yet.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {logs.map((row) => (
                  <li key={row.id} className="px-4 py-3 text-xs">
                    <p className="text-white/80">{row.message}</p>
                    <p className="mt-1 tabular-nums text-[10px] text-white/35">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </DashboardSurface>
    </motion.section>
  );
}
