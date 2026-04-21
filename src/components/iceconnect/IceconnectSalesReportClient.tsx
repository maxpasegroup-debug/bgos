"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Row = {
  user_id: string;
  name: string;
  email: string;
  prospects_7d: number;
  calls_logged_today: number;
  trials_30d: number;
  onboarding?: {
    current_day: number;
    completed: boolean;
    progress_pct: number;
    started_at: string | null;
  };
};

export function IceconnectSalesReportClient() {
  const [bdes, setBdes] = useState<Row[]>([]);
  const [totals, setTotals] = useState({
    prospects_7d: 0,
    missions_completed_today: 0,
    trials_started_30d: 0,
    conversion_rate: 0,
  });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/sales/report", { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        bdes?: Row[];
        totals?: typeof totals;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setBdes(j.bdes ?? []);
      if (j.totals) setTotals(j.totals);
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

  const card: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 12,
    color: "white",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 0 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Sales report</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 18px" }}>
        BDE activity, trials, and conversion — updated from Nexa field data.
      </p>
      {err ? <p style={{ color: "#f87171", fontSize: 14 }}>{err}</p> : null}

      <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>Prospects (7d)</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 0" }}>{totals.prospects_7d}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>Missions done today</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 0" }}>{totals.missions_completed_today}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>Trials (30d)</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 0" }}>{totals.trials_started_30d}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>Conversion</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 0" }}>{totals.conversion_rate}%</p>
        </div>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
        BDE PERFORMANCE
      </p>
      {bdes.map((b) => (
        <div key={b.user_id} style={card}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>{b.name}</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 8px" }}>{b.email}</p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {b.prospects_7d} prospects (7d) · {b.calls_logged_today} calls today · {b.trials_30d} trials (30d)
          </p>
          {b.onboarding ? (
            <p style={{ fontSize: 12, color: "rgba(79,209,255,0.85)", margin: "8px 0 0" }}>
              Onboarding: day {b.onboarding.current_day}/7 · {Math.round(b.onboarding.progress_pct)}% overall
              {b.onboarding.completed ? " · complete" : ""}
              {!b.onboarding.started_at ? " · not started" : ""}
            </p>
          ) : null}
        </div>
      ))}
      {bdes.length === 0 && !err ? (
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No BDEs in your tree yet.</p>
      ) : null}
    </div>
  );
}
