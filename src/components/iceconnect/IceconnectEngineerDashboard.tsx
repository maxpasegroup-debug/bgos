"use client";

import { useCallback, useEffect, useState } from "react";
import { IcPanel } from "./IcPanel";

type Visit = {
  id: string;
  name: string;
  phone: string;
  siteReport: string | null;
};

export function IceconnectEngineerDashboard() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/iceconnect/engineer/visits", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load visits");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { visits: Visit[] };
    setVisits(data.visits);
    setErr(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReport(leadId: string) {
    const report = drafts[leadId]?.trim();
    if (!report) return;
    setBusy(leadId);
    try {
      const res = await fetch("/api/iceconnect/engineer/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, report }),
      });
      if (!res.ok) {
        setErr("Could not save report");
        return;
      }
      setDrafts((d) => ({ ...d, [leadId]: "" }));
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading assigned visits…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site visits</h1>
        <p className="mt-1 text-sm text-white/50">Visits assigned to you (Visit stage).</p>
      </div>
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <IcPanel title="Assigned visits">
        {visits.length === 0 ? (
          <p className="text-sm text-white/45">No site visits assigned.</p>
        ) : (
          <ul className="space-y-6">
            {visits.map((v) => (
              <li key={v.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="font-medium text-white">{v.name}</p>
                <p className="text-xs text-white/45">{v.phone}</p>
                {v.siteReport ? (
                  <p className="mt-2 text-sm text-white/70">
                    <span className="text-white/40">Saved report:</span> {v.siteReport.slice(0, 200)}
                    {v.siteReport.length > 200 ? "…" : ""}
                  </p>
                ) : null}
                <textarea
                  value={drafts[v.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [v.id]: e.target.value }))}
                  placeholder="Site survey notes, measurements, photos summary…"
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-500/40"
                />
                <button
                  type="button"
                  disabled={busy === v.id || !(drafts[v.id]?.trim())}
                  onClick={() => void submitReport(v.id)}
                  className="mt-2 rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  Upload report
                </button>
              </li>
            ))}
          </ul>
        )}
      </IcPanel>
    </div>
  );
}
