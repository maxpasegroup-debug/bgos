"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";

type Partner = {
  id: string;
  phone: string;
  name: string | null;
  totalRevenue: number;
  conversions: number;
  companiesCount: number;
  createdAt: string;
};

export default function ChannelPartnersPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [rows, setRows] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/channel-partners", { credentials: "include" });
        const j = ((await readApiJson(res, "channel-partners/list")) ?? {}) as {
          ok?: boolean;
          error?: string;
          partners?: Partner[];
        };
        if (!res.ok || j.ok !== true) {
          if (!cancelled) setError(j.error || "Could not load channel partners.");
          return;
        }
        if (!cancelled) setRows(Array.isArray(j.partners) ? j.partners : []);
      } catch (e) {
        if (!cancelled) setError(formatFetchFailure(e, "Could not load channel partners"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const card = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  return (
    <div className={`mx-auto max-w-6xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className={card}>
        <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>
          Channel Partners
        </h1>
        <p className={muted + " mt-1"}>Referral partner performance and conversion growth.</p>
      </div>
      {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        {rows.length === 0 && !error ? <div className={card + " " + muted}>No partners yet.</div> : null}
        {rows.map((p) => (
          <Link key={p.id} href={`/bgos/control/sales/channel-partners?partner=${encodeURIComponent(p.id)}`} className={card}>
            <p className={light ? "font-semibold text-slate-900" : "font-semibold text-white"}>
              {p.name || "Partner"} ({p.phone})
            </p>
            <p className={muted + " mt-1"}>
              Companies: {p.companiesCount} · Conversions: {p.conversions} · Revenue: {p.totalRevenue.toFixed(0)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
