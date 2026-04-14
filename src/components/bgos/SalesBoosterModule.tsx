"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import {
  patchSalesBoosterConfig,
  postSalesBoosterUpgradeRequest,
} from "@/lib/sales-booster-client";
import type { SalesBoosterPayload, SalesBoosterPro } from "@/types";
import { BgosShineButton } from "./BgosShineButton";
import { easePremium, fadeUp } from "./motion";
import { formatFetchFailure } from "@/lib/api-fetch";

function formatInr(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function triggerBadgeClass(trigger: SalesBoosterPro["autoFollowUps"][number]["trigger"]) {
  switch (trigger) {
    case "overdue_task":
      return "border-red-500/35 bg-red-500/10 text-red-200/90";
    case "stale_lead":
      return "border-amber-500/35 bg-amber-500/10 text-amber-200/90";
    default:
      return "border-cyan-500/35 bg-cyan-500/10 text-cyan-200/90";
  }
}

function onLeadCreatedLabel(mode: SalesBoosterPro["onLeadCreated"]) {
  switch (mode) {
    case "assign":
      return "Assign to employee";
    case "whatsapp":
      return "WhatsApp (sim)";
    default:
      return "Assign + WhatsApp";
  }
}

function triggerLabel(trigger: SalesBoosterPro["autoFollowUps"][number]["trigger"]) {
  switch (trigger) {
    case "overdue_task":
      return "Overdue task";
    case "stale_lead":
      return "Stale pipeline";
    case "due_within_24h":
      return "Due within 24h";
    default:
      return trigger;
  }
}

const UPGRADE_EMAIL = process.env.NEXT_PUBLIC_BGOS_UPGRADE_EMAIL?.trim();

export function SalesBoosterModule({
  salesBooster,
  hasDashboard,
  canConfigure = false,
  onSettingsSaved,
}: {
  salesBooster: SalesBoosterPayload | undefined;
  hasDashboard: boolean;
  /** ADMIN / MANAGER — can PATCH `/api/sales-booster/config`. */
  canConfigure?: boolean;
  onSettingsSaved?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [automationOn, setAutomationOn] = useState(true);
  const [tick, setTick] = useState(0);
  const [upgradeNote, setUpgradeNote] = useState("");
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!salesBooster?.featuresUnlocked || !automationOn) return;
    const booster = salesBooster as SalesBoosterPro;
    if (!booster.whatsappSimulation.length) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 4000);
    return () => window.clearInterval(id);
  }, [salesBooster, automationOn]);

  const waHighlight = useMemo(() => {
    if (!salesBooster?.featuresUnlocked) return 0;
    const booster = salesBooster as SalesBoosterPro;
    if (!booster.whatsappSimulation.length) return 0;
    return tick % booster.whatsappSimulation.length;
  }, [salesBooster, tick]);

  async function onRequestUpgrade() {
    setUpgradeBusy(true);
    setUpgradeMsg(null);
    try {
      const { ok, message } = await postSalesBoosterUpgradeRequest(
        upgradeNote.trim() || undefined,
      );
      setUpgradeMsg(message);
      if (ok) setUpgradeNote("");
    } catch (e) {
      console.error("API ERROR:", e);
      setUpgradeMsg(formatFetchFailure(e, "Could not send upgrade request"));
    } finally {
      setUpgradeBusy(false);
    }
  }

  if (!hasDashboard || !salesBooster) {
    return (
      <motion.section
        id="sales-booster"
        variants={fadeUp}
        className="col-span-full"
        style={{ scrollMarginTop: "5.5rem" }}
      >
        <DashboardSurface className="p-6 sm:p-7">
          <div className="h-24 animate-pulse rounded-lg bg-white/[0.06]" />
        </DashboardSurface>
      </motion.section>
    );
  }

  if (!salesBooster.featuresUnlocked) {
    return (
      <motion.section
        id="sales-booster"
        variants={fadeUp}
        className="col-span-full"
        style={{ scrollMarginTop: "5.5rem" }}
      >
        <DashboardSurface className="relative overflow-hidden border-[#FFC300]/25 p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FFC300]/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
                Sales Booster · Pro
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Turn pipeline data into revenue
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/60">
                {salesBooster.companyName ? (
                  <>
                    <span className="font-medium text-white/90">{salesBooster.companyName}</span> is
                    on{" "}
                  </>
                ) : null}
                <span className="font-medium text-white/85">Basic</span>. Upgrade to{" "}
                <span className="text-[#FFC300]">Pro</span> to unlock Sales Booster: automated
                follow-up triggers, smart lead prioritization, and next-action suggestions (plus
                simulated WhatsApp previews for your team).
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-[#FFC300]">●</span>
                  <strong className="font-medium text-white/85">Auto follow-up triggers</strong>
                  <span className="text-white/50">— overdue tasks, stale leads, due-soon tasks</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#FFC300]">●</span>
                  <strong className="font-medium text-white/85">Lead prioritization</strong>
                  <span className="text-white/50">— scored queue so reps call the right lead first</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#FFC300]">●</span>
                  <strong className="font-medium text-white/85">Suggest next actions</strong>
                  <span className="text-white/50">— CRM stage hints from your live pipeline rules</span>
                </li>
              </ul>
              <p className="mt-4 text-xs font-medium text-[#FFC300]/90">
                Monetization: request activation below — we log it on your company for billing &
                onboarding.
              </p>
            </div>
            <div className="flex w-full max-w-md shrink-0 flex-col gap-4 rounded-xl border border-white/10 bg-black/30 p-4 sm:p-5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Optional note for sales
              </label>
              <textarea
                value={upgradeNote}
                onChange={(e) => setUpgradeNote(e.target.value)}
                placeholder="e.g. 5 telecallers, need Pro this month"
                rows={3}
                className="resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FFC300]/35"
              />
              <BgosShineButton
                variant="yellow"
                className="min-h-[48px] w-full px-8"
                type="button"
                disabled={upgradeBusy}
                onClick={() => void onRequestUpgrade()}
              >
                {upgradeBusy ? "Sending…" : "Request Pro & Sales Booster"}
              </BgosShineButton>
              {UPGRADE_EMAIL ? (
                <a
                  href={`mailto:${UPGRADE_EMAIL}?subject=${encodeURIComponent("Pro / Sales Booster upgrade")}`}
                  className="text-center text-xs font-medium text-[#FFC300] underline-offset-2 hover:underline"
                >
                  Or email {UPGRADE_EMAIL}
                </a>
              ) : null}
              {upgradeMsg ? (
                <p
                  className={`text-center text-xs ${
                    upgradeMsg.includes("recorded") || upgradeMsg.includes("reach out")
                      ? "text-emerald-300/90"
                      : "text-white/70"
                  }`}
                  role="status"
                >
                  {upgradeMsg}
                </p>
              ) : (
                <p className="text-center text-[10px] text-white/35">
                  No charge until Pro is activated on your workspace.
                </p>
              )}
            </div>
          </div>
        </DashboardSurface>
      </motion.section>
    );
  }

  const booster = salesBooster as SalesBoosterPro;

  return (
    <motion.section
      id="sales-booster"
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-white sm:text-base">Sales Booster</h2>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Pro · active
              </span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              Auto triggers, prioritization, and next actions from your live leads. WhatsApp column is
              a simulation only — no external messages are sent.
            </p>
            {canConfigure ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FFC300]/90">
                  New lead automation
                </p>
                <p className="mt-1 text-[10px] text-white/40">
                  Fires when a lead is created. Assign runs only if no teammate was chosen on the form
                  (load-balanced). Reminder tasks use titles starting with “Sales Booster:” — duplicates
                  are skipped.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <label className="block min-w-[12rem] flex-1 text-[10px] font-medium uppercase tracking-wider text-white/45">
                    On create
                    <select
                      disabled={settingsBusy}
                      value={booster.onLeadCreated}
                      onChange={(e) => {
                        const onLeadCreated = e.target.value as SalesBoosterPro["onLeadCreated"];
                        setSettingsMsg(null);
                        setSettingsBusy(true);
                        void patchSalesBoosterConfig({ onLeadCreated }).then((r) => {
                          setSettingsBusy(false);
                          if (r.ok) onSettingsSaved?.();
                          else setSettingsMsg(r.message ?? "Could not save.");
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
                    >
                      <option value="assign">{onLeadCreatedLabel("assign")}</option>
                      <option value="whatsapp">{onLeadCreatedLabel("whatsapp")}</option>
                      <option value="both">{onLeadCreatedLabel("both")}</option>
                    </select>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/75">
                    <input
                      type="checkbox"
                      disabled={settingsBusy}
                      checked={booster.followUpScheduleEnabled}
                      onChange={(e) => {
                        const followUpScheduleEnabled = e.target.checked;
                        setSettingsMsg(null);
                        setSettingsBusy(true);
                        void patchSalesBoosterConfig({ followUpScheduleEnabled }).then((r) => {
                          setSettingsBusy(false);
                          if (r.ok) onSettingsSaved?.();
                          else setSettingsMsg(r.message ?? "Could not save.");
                        });
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-[#FFC300] focus:ring-[#FFC300]/30"
                    />
                    {"Day 1, 3 & 5 reminder tasks"}
                  </label>
                </div>
                <p className="mt-2 text-[10px] text-white/45">
                  <span className="font-medium text-white/60">{booster.scheduledBoosterTaskCount}</span>{" "}
                  pending Sales Booster reminders company-wide (visible in task lists and dashboard
                  counts).
                </p>
                {settingsMsg ? (
                  <p className="mt-2 text-xs text-amber-200/90" role="status">
                    {settingsMsg}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-white/40">
                New leads: {onLeadCreatedLabel(booster.onLeadCreated)}
                {booster.followUpScheduleEnabled ? " · Reminders on" : " · Reminders off"}
                {` · ${booster.scheduledBoosterTaskCount} booster task(s) open`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Triggers on
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={automationOn}
              onClick={() => setAutomationOn(!automationOn)}
              className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
                automationOn
                  ? "border-[#FFC300]/50 bg-[#FFC300]/20"
                  : "border-white/15 bg-white/[0.06]"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                  automationOn ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FFC300]">
              Auto follow-up triggers
            </h3>
            <p className="mt-1 text-[10px] text-white/40">
              Rule-based queue — use with your CRM tasks and outreach workflow.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              {booster.autoFollowUps.length === 0 ? (
                <li className="text-white/45">No triggers right now — nothing overdue or stale.</li>
              ) : (
                booster.autoFollowUps.map((f) => (
                  <li key={f.leadId} className="border-b border-white/5 pb-3 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{f.leadName}</span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${triggerBadgeClass(f.trigger)}`}
                      >
                        {triggerLabel(f.trigger)}
                      </span>
                      <span className="text-[10px] text-white/40">{f.channel}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/50">{f.reason}</p>
                    <p className="mt-1 text-xs font-medium text-cyan-200/90">{f.nextAction}</p>
                  </li>
                ))
              )}
            </ul>

            <div className="mt-6 border-t border-white/10 pt-5">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#25D366]">
                Outbound preview (simulated)
              </h4>
              <p className="mt-0.5 text-[10px] text-white/35">
                {automationOn ? "Rotating preview" : "Paused"}
              </p>
              <ul className="mt-3 space-y-2">
                {(booster.whatsappSimulation.length > 0 ? booster.whatsappSimulation : []).map(
                  (m, i) => (
                    <motion.li
                      key={m.id}
                      animate={
                        reduceMotion || !automationOn
                          ? undefined
                          : i === waHighlight
                            ? { scale: 1.01, opacity: 1 }
                            : { scale: 1, opacity: 0.72 }
                      }
                      transition={{ duration: 0.35, ease: easePremium }}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        m.state === "sent_simulated"
                          ? "border-[#25D366]/35 bg-[#25D366]/[0.07]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-white/45">
                        <span>{m.leadName}</span>
                        <span className="tabular-nums">{m.phoneMasked}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-white/80">{m.preview}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
                        <span>
                          {m.state === "sent_simulated" ? "Delivered (sim)" : "Queued (sim)"}
                        </span>
                        <span>
                          {new Date(m.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </motion.li>
                  ),
                )}
              </ul>
              {booster.whatsappSimulation.length === 0 ? (
                <p className="mt-2 text-xs text-white/45">No open leads to preview.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">
              Lead prioritization
            </h3>
            <p className="mt-1 text-[10px] text-white/40">
              Highest scores = call first (stage, value, overdue, staleness).
            </p>
            <ul className="mt-4 space-y-2">
              {booster.prioritizedLeads.length === 0 ? (
                <li className="text-sm text-white/45">No active leads to rank.</li>
              ) : (
                booster.prioritizedLeads.map((p) => (
                  <li
                    key={p.leadId}
                    className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{p.leadName}</p>
                      <p className="text-[10px] text-white/40">
                        {p.currentStatusLabel} · {p.assigneeName}
                      </p>
                      <p className="text-[10px] text-white/50">{p.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums text-[#FFC300]">{p.score}</p>
                      <p className="text-[10px] text-white/40">{formatInr(p.value)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Suggest next actions
            </h3>
            <p className="mt-1 text-[10px] text-white/40">
              Suggested CRM stage moves from your pipeline rules.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {booster.statusSuggestions.length === 0 ? (
                <li className="text-white/45">No forward moves for top leads (e.g. already won/lost).</li>
              ) : (
                booster.statusSuggestions.map((s) => (
                  <li key={s.leadId} className="border-b border-white/5 pb-3 text-white/80 last:border-0">
                    <span className="font-medium text-white">{s.leadName}</span>
                    <span className="text-white/40">
                      {" "}
                      {s.currentStatusLabel} →{" "}
                      <span className="text-cyan-300/90">{s.suggestedStatusLabel}</span>
                    </span>
                    <p className="mt-1 text-xs text-white/45">{s.rationale}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </DashboardSurface>
    </motion.section>
  );
}
