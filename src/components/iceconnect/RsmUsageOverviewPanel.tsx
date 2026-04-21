"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Overview = {
  team: { bde_count: number; flagged_companies: number };
  performance: { conversion_rate: number; converted_flags: number; total_flags: number };
  recent_flags: Array<{
    id: string;
    company_id: string;
    company_name: string;
    kind: string;
    status: string;
  }>;
};

export function RsmUsageOverviewPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/usage/rsm-overview", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<Overview>;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setData({
        team: j.team!,
        performance: j.performance!,
        recent_flags: j.recent_flags ?? [],
      });
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const glass: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
    color: "white",
  };

  if (err) {
    return (
      <div style={glass}>
        <p style={{ color: "#f87171", fontSize: 14, margin: 0 }}>{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={glass}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
        CAPACITY & REVENUE SIGNALS
      </p>
      <div style={{ ...glass, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Flagged</p>
          <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{data.team.flagged_companies}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>BDEs</p>
          <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{data.team.bde_count}</p>
        </div>
      </div>
      <div style={glass}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>Conversion (flags → won)</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#34D399", margin: 0 }}>{data.performance.conversion_rate}%</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "8px 0 0" }}>
          {data.performance.converted_flags} / {data.performance.total_flags} historical
        </p>
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
        FLAGGED COMPANIES
      </p>
      <div style={glass}>
        {data.recent_flags.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>None active.</p>
        ) : (
          data.recent_flags.map((f) => (
            <p key={f.id} style={{ fontSize: 13, margin: "0 0 8px" }}>
              <strong>{f.company_name}</strong> · {f.kind} · {f.status}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
