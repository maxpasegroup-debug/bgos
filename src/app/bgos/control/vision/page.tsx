"use client";

import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

type VisionJson = {
  ok?: boolean;
  companyTargets?: {
    companyId: string;
    companyName: string;
    targetRevenueOneMonth: number;
    targetLeadsOneMonth: number;
  }[];
  employeeTargets?: { dayKey: string; targetCalls: number; targetLeads: number }[];
  departmentTargetsNote?: string;
};

export default function ControlVisionPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [data, setData] = useState<VisionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [rev, setRev] = useState("");
  const [leads, setLeads] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/bgos/control/vision", { credentials: "include" });
      const j = (await res.json()) as VisionJson;
      if (!res.ok || !j.ok) {
        setError("Could not load vision data.");
        return;
      }
      setData(j);
    } catch {
      setError("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";
  const h1 = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";

  async function saveCompanyTarget(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    const targetRevenueOneMonth = Number(rev);
    const targetLeadsOneMonth = Number(leads);
    if (!companyId.trim() || Number.isNaN(targetRevenueOneMonth) || Number.isNaN(targetLeadsOneMonth)) {
      setSaveMsg("Enter company ID and numeric targets.");
      return;
    }
    const res = await fetch("/api/bgos/control/vision/company-target", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyId.trim(), targetRevenueOneMonth, targetLeadsOneMonth }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    setSaveMsg(j.ok ? "Saved company target." : j.error ?? "Save failed");
    if (j.ok) void load();
  }

  return (
    <div className={`mx-auto max-w-6xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <h1 className={h1}>Vision &amp; Targets</h1>
      <p className={muted + " mt-1"}>Company growth plans, department note, and internal daily targets.</p>
      {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}

      {data ? (
        <div className="mt-8 space-y-8">
          <div className={cardShell}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Company targets</p>
            <ul className="mt-3 space-y-2 text-sm">
              {(data.companyTargets ?? []).map((c) => (
                <li key={c.companyId} className={muted}>
                  {c.companyName} — revenue/mo ₹{c.targetRevenueOneMonth.toFixed(0)}, leads/mo{" "}
                  {c.targetLeadsOneMonth}
                </li>
              ))}
            </ul>
            <form onSubmit={saveCompanyTarget} className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <p className={muted + " text-xs font-semibold"}>Create / update company target</p>
              <input
                className={
                  light
                    ? "w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    : "w-full rounded border border-white/10 bg-black/20 px-2 py-1 text-sm text-white"
                }
                placeholder="Company ID"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              />
              <input
                className={
                  light
                    ? "w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    : "w-full rounded border border-white/10 bg-black/20 px-2 py-1 text-sm text-white"
                }
                placeholder="Target revenue / month (INR)"
                value={rev}
                onChange={(e) => setRev(e.target.value)}
              />
              <input
                className={
                  light
                    ? "w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    : "w-full rounded border border-white/10 bg-black/20 px-2 py-1 text-sm text-white"
                }
                placeholder="Target leads / month"
                value={leads}
                onChange={(e) => setLeads(e.target.value)}
              />
              <button
                type="submit"
                className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Assign target
              </button>
              {saveMsg ? <p className="text-xs text-emerald-500">{saveMsg}</p> : null}
            </form>
          </div>

          <div className={cardShell}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Department targets</p>
            <p className={muted + " mt-2 text-sm"}>{data.departmentTargetsNote}</p>
          </div>

          <div className={cardShell}>
            <p className={light ? "font-bold text-slate-900" : "font-bold text-white"}>Employee targets (internal org)</p>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
              {(data.employeeTargets ?? []).map((t) => (
                <li key={t.dayKey} className={muted}>
                  {t.dayKey} — calls {t.targetCalls}, leads {t.targetLeads}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : !error ? (
        <p className={muted + " mt-6"}>Loading…</p>
      ) : null}
    </div>
  );
}
