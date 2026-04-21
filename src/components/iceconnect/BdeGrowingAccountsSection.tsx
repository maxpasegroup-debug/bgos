"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Alert = {
  company_id: string;
  company_name: string;
  kind: string;
  usage_pct: number;
  message: string;
};

export function BdeGrowingAccountsSection() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/usage/bde-alerts", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; alerts?: Alert[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setAlerts(j.alerts ?? []);
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
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 12,
    color: "white",
    textAlign: "left",
  };

  return (
    <div style={{ ...glass, borderColor: "rgba(251,191,36,0.25)" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(251,191,36,0.7)", margin: "0 0 10px" }}>
        YOUR ACCOUNTS GROWING
      </p>
      {err ? <p style={{ color: "#f87171", fontSize: 13 }}>{err}</p> : null}
      {alerts.length === 0 && !err ? (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>No capacity pressure right now.</p>
      ) : (
        alerts.map((a) => (
          <div
            key={`${a.company_id}-${a.kind}`}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <strong style={{ fontSize: 14 }}>{a.company_name}</strong>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              {a.kind} · {a.usage_pct}% · {a.message}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
