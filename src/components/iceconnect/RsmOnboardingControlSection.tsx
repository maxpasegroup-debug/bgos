"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Row = {
  id: string;
  company_name: string;
  status: string;
  assigned_bdm_id: string | null;
  assigned_bde_id: string | null;
};

export function RsmOnboardingControlSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [bdmId, setBdmId] = useState("");
  const [bdeId, setBdeId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/pipeline", { credentials: "include" });
      const body = (await res.json()) as { ok?: boolean; data?: Row[]; error?: string };
      if (!res.ok || body.ok !== true) {
        setErr(body.error ?? "Could not load onboarding pipeline.");
        return;
      }
      setRows(body.data ?? []);
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load onboarding pipeline."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function assignToMyTeam() {
    if (!selected) return;
    setBusyId(selected.id);
    setErr(null);
    try {
      const res = await apiFetch(`/api/onboarding/pipeline/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "assign",
          assigned_bdm_id: bdmId.trim() || undefined,
          assigned_bde_id: bdeId.trim() || undefined,
          notes: "RSM assignment reviewed.",
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setErr(body.error ?? "Could not assign onboarding.");
        return;
      }
      setSelected(null);
      setBdmId("");
      setBdeId("");
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not assign onboarding."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={glass}>
      <p style={metaLabel}>ONBOARDING CONTROL</p>
      <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>RSM pipeline visibility</h3>
      {err ? <p style={{ margin: "0 0 8px", color: "#fca5a5", fontSize: 12 }}>{err}</p> : null}
      {selected ? (
        <div>
          <button type="button" onClick={() => setSelected(null)} style={linkBtn}>
            ← Back
          </button>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>{selected.company_name}</p>
          <label style={label}>Assign BDM user ID</label>
          <input value={bdmId} onChange={(e) => setBdmId(e.target.value)} style={inp} />
          <label style={label}>Assign BDE user ID</label>
          <input value={bdeId} onChange={(e) => setBdeId(e.target.value)} style={inp} />
          <button type="button" disabled={busyId === selected.id} onClick={() => void assignToMyTeam()} style={btn}>
            Save assignment
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>No onboarding records yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.slice(0, 8).map((row) => (
            <li key={row.id} style={item}>
              <div>
                <strong style={{ fontSize: 14 }}>{row.company_name}</strong>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                  {row.status.replace(/_/g, " ")}
                </p>
              </div>
              <button type="button" disabled={busyId === row.id} onClick={() => setSelected(row)} style={btn}>
                Assign/Reassign
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const glass: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 14,
};

const metaLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: "rgba(79,209,255,0.55)",
  margin: "0 0 6px",
};

const item: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const btn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(79,209,255,0.3)",
  background: "rgba(79,209,255,0.12)",
  color: "#4FD1FF",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#4FD1FF",
  padding: 0,
  marginBottom: 8,
  cursor: "pointer",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 4,
};

const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(0,0,0,0.2)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "9px 10px",
  marginBottom: 8,
};
