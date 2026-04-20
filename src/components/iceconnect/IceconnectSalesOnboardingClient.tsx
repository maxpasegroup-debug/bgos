"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Row = {
  id: string;
  company_name: string;
  boss_email: string;
  dashboard_type: string;
  status: string;
  created_by: { name: string; email: string };
  created_at: string;
};

type Detail = Row & {
  notes: string | null;
  sales_questionnaire: Record<string, string> | null;
  tech_template: string | null;
  tech_notes: string | null;
};

export function IceconnectSalesOnboardingClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [teamStructure, setTeamStructure] = useState("");
  const [roles, setRoles] = useState("");
  const [departments, setDepartments] = useState("");
  const [expectedUsers, setExpectedUsers] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding-requests?scope=sales", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; requests?: Row[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setRows(j.requests ?? []);
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setErr(null);
    try {
      const res = await apiFetch(`/api/onboarding-requests/${id}`, { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; request?: Detail; error?: string };
      if (!res.ok || !j.ok || !j.request) {
        setErr(j.error ?? "Could not open");
        return;
      }
      const q = j.request.sales_questionnaire as Record<string, string> | null;
      setSelected(j.request);
      setTeamStructure(q?.team_structure ?? "");
      setRoles(q?.roles ?? "");
      setDepartments(q?.departments ?? "");
      setExpectedUsers(q?.expected_users ?? "");
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }

  async function saveQuestionnaire() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/onboarding-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "sales_save",
          team_structure: teamStructure,
          roles,
          departments,
          expected_users: expectedUsers,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Save failed");
        return;
      }
      await load();
      await openDetail(selected.id);
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/onboarding-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "sales_approve" }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Approve failed");
        return;
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
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Onboarding requests</h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 18px" }}>
        Review, capture structure, then send to Tech.
      </p>
      {err ? <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{err}</p> : null}

      {!selected ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" style={card} onClick={() => void openDetail(r.id)}>
                <strong>{r.company_name}</strong>
                <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  {r.dashboard_type} · {r.status} · {r.created_by.name}
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No requests in queue.</p>
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
              Boss: {selected.boss_email} · Type: {selected.dashboard_type} · Status: {selected.status}
            </p>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", margin: "16px 0 8px" }}>
            QUESTIONNAIRE
          </p>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Team structure</label>
          <textarea
            value={teamStructure}
            onChange={(e) => setTeamStructure(e.target.value)}
            rows={2}
            style={ta}
          />
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Roles</label>
          <textarea value={roles} onChange={(e) => setRoles(e.target.value)} rows={2} style={ta} />
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Departments</label>
          <textarea
            value={departments}
            onChange={(e) => setDepartments(e.target.value)}
            rows={2}
            style={ta}
          />
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Expected users</label>
          <textarea
            value={expectedUsers}
            onChange={(e) => setExpectedUsers(e.target.value)}
            rows={2}
            style={ta}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => void saveQuestionnaire()}
            style={btnSecondary}
          >
            Save review
          </button>
          <button type="button" disabled={busy || selected.status !== "sales_review"} onClick={() => void approve()} style={btnPrimary}>
            Approve → Tech queue
          </button>
          {selected.status === "pending" ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
              Save the questionnaire first to enable Approve.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

const ta: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  marginBottom: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.2)",
  color: "white",
  fontSize: 15,
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "linear-gradient(135deg, rgba(79,209,255,0.35), rgba(124,92,255,0.35))",
  color: "white",
};

const btnSecondary: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.15)",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "rgba(255,255,255,0.06)",
  color: "white",
};
