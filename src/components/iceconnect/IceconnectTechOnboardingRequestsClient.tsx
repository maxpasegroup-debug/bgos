"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Row = {
  id: string;
  company_name: string;
  status: string;
  notes: string | null;
};

export function IceconnectTechOnboardingRequestsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [techNotes, setTechNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Row[]> => {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/pipeline", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; data?: Row[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return [];
      }
      const techQueue = (j.data ?? []).filter((r) => r.status === "sent_to_tech");
      setRows(techQueue);
      return techQueue;
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
      return [];
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openDetail(row: Row) {
    setSelected(row);
    setTechNotes("");
  }

  async function saveTechStructure() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/onboarding/pipeline/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "tech_update",
          notes: techNotes,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      const refreshed = await load();
      const updated = refreshed.find((r) => r.id === selected.id) ?? null;
      if (updated) {
        openDetail(updated);
      } else {
        setSelected(null);
      }
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function provisionDashboard() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(`/api/onboarding/pipeline/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "tech_complete", notes: techNotes }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Provisioning failed");
        return;
      }
      if (j.message) {
        setSuccessMsg(j.message);
      }
      setSelected(null);
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 10,
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
    color: "white",
    fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 0 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Tech · Onboarding</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 18px" }}>
        Pending onboarding queue from sales. Add structure notes and complete provisioning.
      </p>
      {successMsg ? (
        <p style={{ color: "#6ee7b7", fontSize: 14, marginBottom: 12, whiteSpace: "pre-line" }}>
          {successMsg}
        </p>
      ) : null}
      {err ? <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{err}</p> : null}

      {!selected ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" style={card} onClick={() => openDetail(r)}>
                <strong>{r.company_name}</strong>
                <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>Nothing in tech queue.</p>
          ) : null}
        </ul>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{
              marginBottom: 14,
              padding: "8px 0",
              background: "none",
              border: "none",
              color: "#4FD1FF",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            ← Back
          </button>
          <div style={{ ...card, cursor: "default" }}>
            <p style={{ margin: "0 0 8px", fontSize: 16 }}>{selected.company_name}</p>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              Status: {selected.status.replace(/_/g, " ")}
            </p>
          </div>
          {selected.notes ? (
            <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.58)", whiteSpace: "pre-wrap" }}>
              {selected.notes}
            </p>
          ) : null}

          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", margin: "16px 0 8px" }}>
            PROVISIONING
          </p>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Structure / provisioning notes</label>
          <textarea
            value={techNotes}
            onChange={(e) => setTechNotes(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(0,0,0,0.2)",
              color: "white",
              fontSize: 15,
              marginTop: 6,
            }}
          />
          <button type="button" disabled={busy || techNotes.trim().length === 0} onClick={() => void saveTechStructure()} style={btnSecondary}>
            Assign structure
          </button>
          <button type="button" disabled={busy} onClick={() => void provisionDashboard()} style={btnPrimary}>
            Provision dashboard & mark completed
          </button>
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "linear-gradient(135deg, rgba(52,211,153,0.35), rgba(79,209,255,0.35))",
  color: "white",
};

const btnSecondary: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.15)",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "rgba(255,255,255,0.06)",
  color: "white",
};
