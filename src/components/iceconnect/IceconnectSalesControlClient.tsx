"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type FlagRow = {
  id: string;
  company_id: string;
  company_name: string;
  kind: string;
  usage_pct: number;
  status: string;
  action_status: string;
  handled_by: string | null;
  updated_at: string;
};

export function IceconnectSalesControlClient() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/usage/control", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; flags?: FlagRow[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setFlags(j.flags ?? []);
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchFlag(
    id: string,
    body: { action_status?: "pending" | "contacted" | "closed"; status?: string },
  ) {
    setBusy(id);
    setErr(null);
    try {
      const res = await apiFetch(`/api/iceconnect/usage/flags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(null);
    }
  }

  const glass: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 12,
    textAlign: "left",
    color: "white",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 0 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Sales control</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 18px" }}>
        High-usage tenants — act before caps block growth.
      </p>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
        HIGH USAGE ALERTS
      </p>
      {err ? <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{err}</p> : null}

      {flags.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No active capacity alerts.</p>
      ) : (
        flags.map((f) => (
          <div key={f.id} style={glass}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <strong style={{ fontSize: 16 }}>{f.company_name}</strong>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                  {f.kind} · {f.usage_pct}% of limit · workflow: {f.action_status}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  Flag status: {f.status}
                </p>
              </div>
            </div>

            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", margin: "14px 0 8px" }}>
              ACTION STATUS
            </p>
            <p style={{ fontSize: 13, margin: "0 0 12px", color: "#FBBF24" }}>{f.action_status}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                disabled={busy === f.id}
                onClick={() => {
                  void navigator.clipboard?.writeText(f.company_name);
                  alert("Company name copied — dial from your phone or CRM.");
                }}
                style={btnOutline}
              >
                Call
              </button>
              <button
                type="button"
                disabled={busy === f.id}
                onClick={() => void patchFlag(f.id, { action_status: "contacted", status: "in_progress" })}
                style={btnOutline}
              >
                Mark contacted
              </button>
              <button
                type="button"
                disabled={busy === f.id}
                onClick={() => void patchFlag(f.id, { status: "converted", action_status: "closed" })}
                style={btnPrimary}
              >
                Close deal
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "none",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  background: "linear-gradient(135deg, rgba(52,211,153,0.35), rgba(79,209,255,0.35))",
  color: "white",
  fontFamily: "inherit",
};

const btnOutline: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontFamily: "inherit",
};
