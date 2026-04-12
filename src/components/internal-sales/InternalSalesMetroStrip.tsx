"use client";

import { InternalSalesStage } from "@prisma/client";

const STEP_LABELS = [
  "Lead Added",
  "Intro Call",
  "Demo / Orientation",
  "Follow-up",
  "Interested",
  "Onboarding Form",
  "Boss Approval",
  "Sent to Tech",
  "Tech Ready",
  "Delivered",
  "Client Live",
] as const;

function currentStepIndex(stage: InternalSalesStage, pendingBoss: boolean): number {
  if (stage === InternalSalesStage.CLOSED_LOST) return -1;
  if (stage === InternalSalesStage.LEAD_ADDED) return 0;
  if (stage === InternalSalesStage.INTRO_CALL) return 1;
  if (stage === InternalSalesStage.DEMO_ORIENTATION) return 2;
  if (stage === InternalSalesStage.FOLLOW_UP) return 3;
  if (stage === InternalSalesStage.INTERESTED) return 4;
  if (stage === InternalSalesStage.ONBOARDING_FORM_FILLED) return pendingBoss ? 6 : 5;
  if (stage === InternalSalesStage.BOSS_APPROVAL_PENDING) return 6;
  if (stage === InternalSalesStage.SENT_TO_TECH) return 7;
  if (stage === InternalSalesStage.TECH_READY) return 8;
  if (stage === InternalSalesStage.DELIVERED) return 9;
  if (stage === InternalSalesStage.CLIENT_LIVE) return 10;
  return 0;
}

export function InternalSalesMetroStrip({
  stage,
  pendingBossApproval,
  theme,
  compact,
}: {
  stage: InternalSalesStage;
  pendingBossApproval?: boolean;
  theme: "bgos" | "ice";
  compact?: boolean;
}) {
  const pendingBoss = !!pendingBossApproval;
  const cur = currentStepIndex(stage, pendingBoss);
  const lost = stage === InternalSalesStage.CLOSED_LOST;

  const track = "flex gap-1 overflow-x-auto pb-1";

  return (
    <div className={track} aria-label="Sales pipeline steps">
      {STEP_LABELS.map((label, idx) => {
        const done = !lost && cur >= 0 && cur > idx;
        const current = !lost && cur === idx;
        const locked = !lost && cur >= 0 && cur < idx;
        const base =
          theme === "bgos"
            ? "shrink-0 rounded-lg border px-2 py-1 text-[10px] font-medium sm:text-xs"
            : "shrink-0 rounded-lg border px-2 py-1 text-[10px] font-medium sm:text-xs";
        let cls = base;
        if (lost) {
          cls += theme === "bgos" ? " border-white/10 text-white/35" : " border-slate-200 text-slate-400";
        } else if (done) {
          cls += theme === "bgos" ? " border-emerald-500/50 bg-emerald-500/15 text-emerald-100" : " border-emerald-200 bg-emerald-50 text-emerald-900";
        } else if (current) {
          cls += theme === "bgos" ? " border-amber-400/60 bg-amber-500/20 text-amber-100" : " border-amber-300 bg-amber-50 text-amber-950";
        } else {
          cls += theme === "bgos" ? " border-white/10 text-white/40 opacity-60" : " border-slate-200 text-slate-400 opacity-70";
        }
        if (locked) cls += " pointer-events-none";
        return (
          <div key={label} className={cls} title={locked ? "Complete earlier stages first" : label}>
            {!compact && <span className="tabular-nums opacity-60">{idx + 1}. </span>}
            {label}
          </div>
        );
      })}
    </div>
  );
}
