"use client";

import { useState, type ReactNode } from "react";
import { postSalesBoosterUpgradeRequest } from "@/lib/sales-booster-client";
import { useOpenPlanUpgrade } from "./BgosUpgradeModalContext";
import { formatFetchFailure } from "@/lib/api-fetch";

type ProFeatureLockProps = {
  locked: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/**
 * When `locked`, shows blurred children with 🔒 and “Upgrade to unlock” (no interaction with inner UI).
 */
export function ProFeatureLock({
  locked,
  title,
  description,
  children,
  className = "",
}: ProFeatureLockProps) {
  const openPricing = useOpenPlanUpgrade();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSalesRequest() {
    setBusy(true);
    setMsg(null);
    try {
      const { ok, message } = await postSalesBoosterUpgradeRequest();
      setMsg(message ?? (ok ? "Request sent." : null));
    } catch (e) {
      console.error("API ERROR:", e);
      setMsg(formatFetchFailure(e, "Could not send upgrade request"));
    } finally {
      setBusy(false);
    }
  }

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none max-h-[min(32rem,78vh)] overflow-hidden rounded-2xl blur-[5px] select-none opacity-[0.42] [&_*]:pointer-events-none"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0B0F19]/60 p-6 text-center backdrop-blur-[4px]">
        <span className="text-2xl select-none" aria-hidden>
          🔒
        </span>
        <p className="text-sm font-semibold text-white">{title}</p>
        {description ? (
          <p className="max-w-sm text-xs leading-relaxed text-white/55">{description}</p>
        ) : null}
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => openPricing()}
            className="rounded-2xl bg-[#FFC300]/92 px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_24px_-8px_rgba(255,195,0,0.35)] transition hover:bg-[#FFC300]"
          >
            Upgrade
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSalesRequest()}
            className="rounded-2xl border border-[#FFC300]/35 bg-[#FFC300]/12 px-5 py-2.5 text-sm font-semibold text-[#FFE08A] transition hover:border-[#FFC300]/50 hover:bg-[#FFC300]/18 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Contact sales"}
          </button>
        </div>
        {msg ? <p className="max-w-xs text-xs text-white/60">{msg}</p> : null}
      </div>
    </div>
  );
}
