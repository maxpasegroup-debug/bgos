"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import type { SalesBoosterPayload, SalesBoosterPro } from "@/types";
import { BgosShineButton } from "./BgosShineButton";
import { easePremium, fadeUp } from "./motion";

function formatInr(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SalesBoosterModule({
  salesBooster,
  hasDashboard,
}: {
  salesBooster: SalesBoosterPayload | undefined;
  hasDashboard: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [automationOn, setAutomationOn] = useState(true);
  const [tick, setTick] = useState(0);

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
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
                NEXA Sales Booster
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Unlock Pro automation
              </h2>
              <p className="mt-2 max-w-xl text-sm text-white/60">
                {salesBooster.companyName ? `${salesBooster.companyName} is on ` : ""}
                <span className="font-medium text-white/85">Basic</span>. Upgrade to{" "}
                <span className="text-[#FFC300]">Pro</span> for auto follow-ups, lead prioritization,
                status suggestions, and WhatsApp-style outreach simulation.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-[#FFC300]">●</span>
                  Auto follow-up logic (simulated sequences)
                </li>
                <li className="flex gap-2">
                  <span className="text-[#FFC300]">●</span>
                  Smart lead prioritization
                </li>
                <li className="flex gap-2">
                  <span className="text-[#FFC300]">●</span>
                  Next-step status suggestions
                </li>
              </ul>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <BgosShineButton variant="yellow" className="min-h-[48px] px-8">
                Upgrade to Pro
              </BgosShineButton>
              <p className="text-center text-[10px] text-white/35 lg:text-left">
                Contact ICECONNECT to change plan
              </p>
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
              <h2 className="text-sm font-semibold text-white sm:text-base">NEXA Sales Booster</h2>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Pro active
              </span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              Simulated automation — no real WhatsApp messages are sent.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Automation
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/25 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#25D366]">
              WhatsApp simulation
            </h3>
            <p className="mt-1 text-[10px] text-white/40">
              Outbound queue (demo) {automationOn ? "· cycling preview" : "· paused"}
            </p>
            <ul className="mt-4 space-y-3">
              {(booster.whatsappSimulation.length > 0 ? booster.whatsappSimulation : []).map((m, i) => (
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
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
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
                    <span>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </motion.li>
              ))}
            </ul>
            {booster.whatsappSimulation.length === 0 ? (
              <p className="mt-3 text-sm text-white/45">No open leads to simulate outreach.</p>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">
                Auto follow-up logic
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm text-white/75">
                {booster.autoFollowUps.length === 0 ? (
                  <li className="text-white/45">No follow-ups queued — pipeline looks current.</li>
                ) : (
                  booster.autoFollowUps.map((f) => (
                    <li key={f.leadId} className="border-b border-white/5 pb-2 last:border-0">
                      <span className="font-medium text-white">{f.leadName}</span>
                      <span className="text-white/40"> · {f.channel}</span>
                      <p className="text-xs text-white/50">{f.reason}</p>
                      <p className="mt-0.5 text-xs text-[#FFC300]/90">{f.nextAction}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Lead prioritization
              </h3>
              <ul className="mt-3 space-y-2">
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
                        <p className="text-[10px] text-white/40">{p.currentStatusLabel}</p>
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Status suggestions
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                {booster.statusSuggestions.length === 0 ? (
                  <li className="text-white/45">No forward moves available for top leads.</li>
                ) : (
                  booster.statusSuggestions.map((s) => (
                    <li key={s.leadId} className="text-white/80">
                      <span className="font-medium text-white">{s.leadName}</span>
                      <span className="text-white/40">
                        {" "}
                        {s.currentStatusLabel} →{" "}
                        <span className="text-cyan-300/90">{s.suggestedStatusLabel}</span>
                      </span>
                      <p className="mt-0.5 text-xs text-white/45">{s.rationale}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </DashboardSurface>
    </motion.section>
  );
}
