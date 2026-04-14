"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { IceconnectWorkspaceView } from "./IceconnectWorkspaceView";
import { IcPanel } from "./IcPanel";

type Visit = {
  id: string;
  name: string;
  phone: string;
  siteReport: string | null;
};

export function IceconnectEngineerDashboard() {
  const { company } = useCompanyBranding();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const submitStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/iceconnect/engineer/visits", { credentials: "include" });
      if (!res.ok) {
        let msg = "Could not load visits.";
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error;
        } catch {
          /* ignore */
        }
        setErr(msg);
        return;
      }
      const data = (await res.json()) as { visits: Visit[] };
      setVisits(Array.isArray(data.visits) ? data.visits : []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReport(leadId: string) {
    const report = drafts[leadId]?.trim();
    if (!report) return;
    setBusy(leadId);
    try {
      const res = await apiFetch("/api/iceconnect/engineer/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, report }),
      });
      if (!res.ok) {
        setErr("Could not save report.");
        return;
      }
      setDrafts((d) => ({ ...d, [leadId]: "" }));
      await load();
    } finally {
      setBusy(null);
    }
  }

  const cn = company?.name?.trim() ?? "your company";
  const hero = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-gray-200/90 bg-white/85 p-5 shadow-sm backdrop-blur-md"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--ice-primary)]">
        Engineer · {cn}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">Site visits & reports</h2>
      <p className="mt-1 text-sm text-gray-500">
        Field visits, measurements, and documentation for installations — tailored to your role.
      </p>
    </motion.div>
  );

  return (
    <IceconnectWorkspaceView
      title="Site visits"
      subtitle="Leads in site-visit stage assigned to you — upload field reports here."
      loading={loading}
      error={err}
      onRetry={() => void load()}
      hero={hero}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <IcPanel title="Today’s focus">
          <p className="text-sm text-gray-600">
            Complete surveys for assigned visits and sync reports so sales can move deals forward.
          </p>
        </IcPanel>
        <IcPanel title="Checklist">
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
            <li>Verify roof/site conditions</li>
            <li>Capture customer sign-off where required</li>
            <li>Upload report before leaving site</li>
          </ul>
        </IcPanel>
      </div>

      <IcPanel title="Assigned visits">
        {visits.length === 0 ? (
          <p className="text-sm text-gray-500">No site visits assigned.</p>
        ) : (
          <ul className="space-y-6">
            {visits.map((v) => (
              <li key={v.id} className="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm">
                <p className="font-medium text-gray-900">{v.name}</p>
                <p className="text-xs text-gray-500">{v.phone}</p>
                {v.siteReport ? (
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-400">Saved report:</span>{" "}
                    {v.siteReport.slice(0, 200)}
                    {v.siteReport.length > 200 ? "…" : ""}
                  </p>
                ) : null}
                <textarea
                  value={drafts[v.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [v.id]: e.target.value }))}
                  placeholder="Site survey notes, measurements, photos summary…"
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[color:var(--ice-primary)] focus:ring-2 focus:ring-[color:var(--ice-primary)]"
                />
                <button
                  type="button"
                  disabled={busy === v.id || !(drafts[v.id]?.trim())}
                  onClick={() => void submitReport(v.id)}
                  className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
                  style={submitStyle}
                >
                  Upload report
                </button>
              </li>
            ))}
          </ul>
        )}
      </IcPanel>
    </IceconnectWorkspaceView>
  );
}
