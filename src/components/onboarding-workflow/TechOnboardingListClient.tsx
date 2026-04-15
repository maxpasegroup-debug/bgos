"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

type Row = {
  id: string;
  status: string;
  planTier: string;
  category: string;
  completionPercent: number;
  deliveryPdfPath: string | null;
  lead: { id: string; name: string } | null;
};

export function TechOnboardingListClient() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/workflow/tech", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; submissions?: Row[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setRows(j.submissions ?? []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const card = light
    ? "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    : "rounded-xl border border-white/10 bg-[#121821]/80 p-4";

  return (
    <div className={`mx-auto max-w-3xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>
        Onboarding workflow
      </h1>
      <p className={light ? "mt-1 text-sm text-slate-600" : "mt-1 text-sm text-white/65"}>
        Assigned submissions — open manage on BGOS for full detail.
      </p>
      {err ? <p className="mt-4 text-sm text-red-500">{err}</p> : null}
      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className={light ? "font-semibold text-slate-900" : "font-semibold text-white"}>
                  {r.lead?.name ?? "No lead"} · {r.planTier} {r.category}
                </p>
                <p className="text-xs opacity-70">
                  {r.status} · {r.completionPercent}%
                </p>
              </div>
              <Link
                href={`/onboarding/manage/${r.id}`}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && !err ? (
        <p className={light ? "mt-8 text-sm text-slate-500" : "mt-8 text-sm text-white/50"}>
          No submissions in queue.
        </p>
      ) : null}
    </div>
  );
}
