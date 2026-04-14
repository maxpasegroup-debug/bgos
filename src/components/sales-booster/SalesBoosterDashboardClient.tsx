"use client";


import { apiFetch } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import type { SalesBoosterPro } from "@/types";

const WA_ADDON =
  "https://wa.me/918089239823?text=Hi%20I%20want%20Sales%20Booster%20Plus%20add-on";

type PerformancePayload = {
  conversionRate: number;
  leadsOpen: number;
  wonThisMonth: number;
  lostThisMonth: number;
  pipelineValue: number;
  leadsByChannel: Record<string, number>;
};

type InboxItem = {
  id: string;
  channel: string;
  title: string;
  preview: string;
  at: string;
  badgeClass: string;
};

function formatInr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SalesBoosterDashboardClient() {
  const [booster, setBooster] = useState<SalesBoosterPro | null>(null);
  const [performance, setPerformance] = useState<PerformancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/sales-booster/module-data", { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        booster?: SalesBoosterPro;
        performance?: PerformancePayload;
        message?: string;
      };
      if (
        !res.ok ||
        !j.booster ||
        !j.booster.featuresUnlocked ||
        (j.booster.plan !== "PRO" && j.booster.plan !== "ENTERPRISE")
      ) {
        setError(j.message ?? "Could not load Sales Booster.");
        setBooster(null);
        return;
      }
      setBooster(j.booster as SalesBoosterPro);
      setPerformance(j.performance ?? null);
    } catch {
      setError("Could not load Sales Booster.");
      setBooster(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inbox = useMemo((): InboxItem[] => {
    if (!booster) return [];
    const rows: InboxItem[] = [];
    for (const w of booster.whatsappSimulation) {
      rows.push({
        id: w.id,
        channel: "WhatsApp",
        title: w.leadName,
        preview: w.preview,
        at: w.at,
        badgeClass: "bg-emerald-500/20 text-emerald-200",
      });
    }
    for (let i = 0; i < booster.autoFollowUps.length; i++) {
      const a = booster.autoFollowUps[i]!;
      rows.push({
        id: `action-${a.leadId}-${i}`,
        channel: a.channel,
        title: a.leadName,
        preview: `${a.reason} — ${a.nextAction}`,
        at: new Date().toISOString(),
        badgeClass: "bg-[#FFC300]/20 text-[#FFE8A8]",
      });
    }
    return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [booster]);

  const patch = useCallback(
    async (patchBody: Record<string, unknown>, key: string) => {
      setBusy(key);
      try {
        const res = await apiFetch("/api/sales-booster/config", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        if (!res.ok) {
          const j = (await res.json()) as { message?: string };
          setError(j.message ?? "Could not save settings.");
          return;
        }
        await load();
        setError(null);
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (!booster && !error) {
    return (
      <div className={`flex min-h-[50vh] items-center justify-center ${BGOS_MAIN_PAD}`}>
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FFC300]/40 border-t-[#FFC300]" />
      </div>
    );
  }

  if (error && !booster) {
    return (
      <div className={`${BGOS_MAIN_PAD} py-10`}>
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!booster) return null;

  const isEnterprise = booster.plan === "ENTERPRISE";
  const showAddonPack = booster.plan === "PRO" && !booster.advancedAddon;

  return (
    <div className={`min-h-0 flex-1 overflow-y-auto ${BGOS_MAIN_PAD} pb-16 pt-6`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFC300]/75">
              Sales Booster
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Your revenue cockpit</h1>
            <p className="mt-1 text-sm text-white/55">
              Inbox, hot leads, and automations — tuned for {booster.companyName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/80">
              {booster.plan === "ENTERPRISE" ? "Enterprise" : "Pro"} workspace
            </span>
            {booster.advancedAddon ? (
              <span className="rounded-full border border-[#FFC300]/40 bg-[#FFC300]/10 px-3 py-1 text-xs font-semibold text-[#FFE8A8]">
                Full Sales Booster tools
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {error}
          </p>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Omni inbox */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_40px_-16px_rgba(0,0,0,0.6)]"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Omni-channel inbox
            </h2>
            <p className="mt-1 text-[11px] text-white/40">Latest conversations and follow-up actions</p>
            <ul className="mt-4 max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto pr-1">
              {inbox.length === 0 ? (
                <li className="rounded-xl border border-white/5 bg-black/20 px-3 py-8 text-center text-sm text-white/45">
                  No inbox items yet. New leads and WhatsApp previews appear here automatically.
                </li>
              ) : (
                inbox.map((row) => (
                  <li
                    key={row.id}
                    className="flex gap-3 rounded-xl border border-white/8 bg-black/25 px-3 py-3 transition hover:border-[#FFC300]/20"
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${row.badgeClass}`}
                    >
                      {row.channel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{row.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-white/55">{row.preview}</p>
                      <p className="mt-1 text-[10px] text-white/35">{formatTime(row.at)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </motion.section>

          {/* Lead feed */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_40px_-16px_rgba(0,0,0,0.6)]"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Lead feed
            </h2>
            <p className="mt-1 text-[11px] text-white/40">Prioritized from your CRM — call these first</p>
            <ul className="mt-4 space-y-2">
              {booster.prioritizedLeads.length === 0 ? (
                <li className="text-sm text-white/45">No active leads to show.</li>
              ) : (
                booster.prioritizedLeads.map((p) => (
                  <li
                    key={p.leadId}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-black/25 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/bgos/leads/${encodeURIComponent(p.leadId)}`}
                        className="text-sm font-semibold text-white hover:text-[#FFC300]"
                      >
                        {p.leadName}
                      </Link>
                      <p className="text-[11px] text-white/45">
                        {p.currentStatusLabel} · {p.assigneeName}
                      </p>
                      <p className="text-[11px] text-white/50">{p.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold tabular-nums text-[#FFC300]">{p.score}</p>
                      <p className="text-[10px] text-white/40">{formatInr(p.value ?? 0)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </motion.section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Automation */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Automation</h2>
            <p className="mt-1 text-[11px] text-white/40">Control how Sales Booster works on new leads</p>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Follow-up schedule</p>
                  <p className="text-[11px] text-white/45">Creates reminders so no lead goes quiet</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={booster.followUpScheduleEnabled}
                  disabled={busy !== null}
                  onClick={() =>
                    void patch({ followUpScheduleEnabled: !booster.followUpScheduleEnabled }, "fu")
                  }
                  className={`relative h-8 w-14 shrink-0 rounded-full transition ${booster.followUpScheduleEnabled ? "bg-emerald-500/80" : "bg-white/15"}`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${booster.followUpScheduleEnabled ? "left-7" : "left-1"}`}
                  />
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-sm font-medium text-white">When a new lead arrives</p>
                <p className="text-[11px] text-white/45">Assign, message, or both</p>
                <select
                  value={booster.onLeadCreated}
                  disabled={busy !== null}
                  onChange={(e) =>
                    void patch(
                      { onLeadCreated: e.target.value as SalesBoosterPro["onLeadCreated"] },
                      "lead",
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
                >
                  <option value="assign">Assign to team</option>
                  <option value="whatsapp">Start WhatsApp path</option>
                  <option value="both">Assign + WhatsApp</option>
                </select>
              </div>

              <p className="text-[11px] text-white/35">
                Scheduled tasks in queue:{" "}
                <span className="font-medium text-[#FFC300]">{booster.scheduledBoosterTaskCount}</span>
              </p>
            </div>

            {showAddonPack ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#FFC300]/35 bg-[#FFC300]/[0.06] p-4">
                <p className="text-sm font-semibold text-[#FFE8A8]">Sales Booster Plus</p>
                <p className="mt-1 text-xs text-white/60">
                  Unlock smart replies, campaign runs, and richer lead scoring on Pro — or switch to
                  Enterprise for everything included.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void patch({ addonEnabled: true }, "addon")}
                    className="rounded-xl bg-[#FFC300] px-4 py-2 text-xs font-bold text-black hover:bg-[#ffdb4d] disabled:opacity-50"
                  >
                    Enable Plus on Pro
                  </button>
                  <a
                    href={WA_ADDON}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.06]"
                  >
                    Chat with BGOS
                  </a>
                </div>
              </div>
            ) : null}

            {booster.advancedAddon ? (
              <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FFC300]/80">
                  Advanced revenue tools
                </p>
                {isEnterprise ? (
                  <p className="text-[11px] text-white/50">Enterprise includes all advanced tools.</p>
                ) : null}
                <ToggleRow
                  label="Smart auto-replies"
                  hint="AI-style messages for faster responses"
                  on={booster.aiAutoReplies}
                  disabled={busy !== null}
                  onToggle={() => void patch({ aiAutoReplies: !booster.aiAutoReplies }, "ai")}
                />
                <ToggleRow
                  label="Milestone campaigns"
                  hint="Runs gentle nudges when leads stall"
                  on={booster.campaignAutomation}
                  disabled={busy !== null}
                  onToggle={() =>
                    void patch({ campaignAutomation: !booster.campaignAutomation }, "camp")
                  }
                />
                <ToggleRow
                  label="Lead scoring boost"
                  hint="Highlights who to call first"
                  on={booster.leadScoring}
                  disabled={busy !== null}
                  onToggle={() => void patch({ leadScoring: !booster.leadScoring }, "score")}
                />
              </div>
            ) : null}
          </motion.section>

          {/* Performance */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">Performance</h2>
            <p className="mt-1 text-[11px] text-white/40">This month — from your live CRM data</p>

            {!performance ? (
              <p className="mt-8 text-sm text-white/45">Loading stats…</p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Win rate
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-[#FFC300]">
                    {performance.conversionRate}%
                  </p>
                  <p className="text-[11px] text-white/45">
                    Won {performance.wonThisMonth} vs lost {performance.lostThisMonth} (this month)
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Open pipeline
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {performance.leadsOpen}
                  </p>
                  <p className="text-[11px] text-white/45">Active leads</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-4 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Pipeline value
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-200/90">
                    {formatInr(performance.pipelineValue)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Leads by source
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {Object.entries(performance.leadsByChannel)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([src, count]) => (
                        <li
                          key={src}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                        >
                          <span className="text-white/75">{src}</span>
                          <span className="font-mono text-[#FFC300]">{count}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-white/45">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={onToggle}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-emerald-500/80" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-7" : "left-1"}`}
        />
      </button>
    </div>
  );
}
