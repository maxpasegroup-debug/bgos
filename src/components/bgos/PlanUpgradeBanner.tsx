"use client";

import Link from "next/link";
import { CompanyPlan } from "@prisma/client";
import { useState } from "react";
import { postSalesBoosterUpgradeRequest } from "@/lib/sales-booster-client";
import { useOpenPlanUpgrade } from "./BgosUpgradeModalContext";
import { formatFetchFailure } from "@/lib/api-fetch";

const UPGRADE_EMAIL = process.env.NEXT_PUBLIC_BGOS_UPGRADE_EMAIL?.trim();

export function PlanUpgradeBanner({ plan }: { plan: CompanyPlan | null }) {
  const openPricing = useOpenPlanUpgrade();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (plan !== CompanyPlan.BASIC) return null;

  async function onQuickRequest() {
    setBusy(true);
    setMsg(null);
    try {
      const { ok, message } = await postSalesBoosterUpgradeRequest();
      setMsg(message);
      if (ok) {
        window.setTimeout(() => setMsg(null), 8000);
      }
    } catch (e) {
      console.error("API ERROR:", e);
      setMsg(formatFetchFailure(e, "Could not send upgrade request"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-[#FFC300]/25 bg-gradient-to-r from-[#FFC300]/10 to-transparent px-4 py-2.5 sm:px-7 lg:px-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/85">
          <span className="font-semibold text-[#FFC300]">Basic plan</span>
          <span className="text-white/50"> — </span>
          Sales Booster (auto follow-ups, prioritization, next actions) and{" "}
          <code className="rounded bg-white/10 px-1 text-xs text-white/70">/api/automation</code> stay
          locked until Pro.{" "}
          {msg ? (
            <span className="block pt-1 text-xs text-emerald-300/90 sm:inline sm:pl-1 sm:pt-0">
              {msg}
            </span>
          ) : null}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => openPricing()}
            className="rounded-lg bg-[#FFC300] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_20px_-4px_rgba(255,195,0,0.5)] transition hover:bg-[#ffcd33]"
          >
            Upgrade
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onQuickRequest()}
            className="rounded-lg border border-[#FFC300]/40 bg-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FFC300] transition hover:border-[#FFC300]/60 hover:bg-[#FFC300]/10 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Request Pro"}
          </button>
          <Link
            href="#sales-booster"
            className="text-xs font-semibold uppercase tracking-wider text-[#FFC300] underline-offset-2 hover:underline"
          >
            Details
          </Link>
          {UPGRADE_EMAIL ? (
            <a
              href={`mailto:${UPGRADE_EMAIL}?subject=${encodeURIComponent("Pro upgrade")}`}
              className="text-[10px] text-white/50 underline-offset-2 hover:text-white/70 hover:underline"
            >
              Email
            </a>
          ) : (
            <span className="text-[10px] text-white/35">Contact ICECONNECT to upgrade</span>
          )}
        </div>
      </div>
    </div>
  );
}
