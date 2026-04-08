"use client";

import { useEffect, useState } from "react";
import { postSalesBoosterUpgradeRequest } from "@/lib/sales-booster-client";
import { useOpenPlanUpgrade } from "./BgosUpgradeModalContext";

const STORAGE_KEY = "bgos-trial-expired-overlay-minimized";
const UPGRADE_EMAIL = process.env.NEXT_PUBLIC_BGOS_UPGRADE_EMAIL?.trim();

export function BgosTrialExpiredOverlay() {
  const openPricing = useOpenPlanUpgrade();
  const [minimized, setMinimized] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactMsg, setContactMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      setMinimized(window.sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function persistMinimized(v: boolean) {
    setMinimized(v);
    try {
      if (v) window.sessionStorage.setItem(STORAGE_KEY, "1");
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  async function onContactSales() {
    if (UPGRADE_EMAIL) {
      window.location.href = `mailto:${UPGRADE_EMAIL}?subject=${encodeURIComponent("BGOS — trial expired")}`;
      return;
    }
    setContactBusy(true);
    setContactMsg(null);
    try {
      const { ok, message } = await postSalesBoosterUpgradeRequest("Trial expired — contact sales");
      setContactMsg(message);
      if (ok) window.setTimeout(() => setContactMsg(null), 8000);
    } catch {
      setContactMsg("Could not send request. Try again or use Upgrade for checkout.");
    } finally {
      setContactBusy(false);
    }
  }

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
      <button
        type="button"
        onClick={() => openPricing()}
        className="rounded-xl bg-[#FFC300] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-black shadow-[0_0_24px_-4px_rgba(255,195,0,0.45)] transition hover:bg-[#ffcd33]"
      >
        Upgrade Now
      </button>
      <button
        type="button"
        disabled={contactBusy}
        onClick={() => void onContactSales()}
        className="rounded-xl border border-[#FFC300]/50 bg-[#FFC300]/10 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#FFE08A] transition hover:border-[#FFC300]/70 hover:bg-[#FFC300]/15 disabled:opacity-50"
      >
        {contactBusy ? "Sending…" : "Contact Sales"}
      </button>
    </div>
  );

  if (minimized) {
    return (
      <div
        className="fixed left-0 right-0 top-0 z-[200] border-b border-[#FFC300]/25 bg-[#0B0F19]/95 px-4 py-2.5 shadow-lg backdrop-blur-md sm:px-6"
        role="region"
        aria-label="Trial expired"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm font-semibold text-white sm:text-left">
            Your trial has expired{" "}
            <span className="font-normal text-white/55">— view-only until you upgrade.</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            {actions}
            <button
              type="button"
              onClick={() => persistMinimized(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 underline-offset-2 hover:text-white hover:underline"
            >
              Expand
            </button>
          </div>
        </div>
        {contactMsg ? (
          <p className="mx-auto mt-1 max-w-6xl text-center text-xs text-emerald-300/90 sm:text-left">
            {contactMsg}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0B0F19]/95 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#FFC300]/20 bg-black/50 p-8 text-center shadow-2xl">
        <h1 id="trial-expired-title" className="text-xl font-bold text-white sm:text-2xl">
          Your trial has expired
        </h1>
        <p className="mt-3 text-sm text-white/60">
          You can still browse your workspace. Creating or changing records is disabled until you upgrade.
        </p>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:items-center">{actions}</div>
        {contactMsg ? (
          <p className="mt-4 text-xs text-emerald-300/90" role="status">
            {contactMsg}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => persistMinimized(true)}
          className="mt-8 text-sm text-[#FFC300]/80 underline-offset-2 hover:text-[#FFC300] hover:underline"
        >
          View dashboard (read-only)
        </button>
      </div>
    </div>
  );
}
