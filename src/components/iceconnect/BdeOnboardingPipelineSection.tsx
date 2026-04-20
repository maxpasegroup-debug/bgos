"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type PipelineRow = {
  id: string;
  company_name: string;
  status: string;
  notes?: string | null;
  owned_by?: { id: string; name: string; role: string } | null;
};

type PipelinePayload = {
  ok?: boolean;
  data?: PipelineRow[];
  counts?: {
    new: number;
    in_progress: number;
    sent_to_tech: number;
    completed: number;
  };
  error?: string;
};

export function BdeOnboardingPipelineSection() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, sent_to_tech: 0, completed: 0 });
  const [selected, setSelected] = useState<PipelineRow | null>(null);
  const [employeeList, setEmployeeList] = useState("");
  const [roles, setRoles] = useState("");
  const [departments, setDepartments] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/pipeline", { credentials: "include" });
      const body = (await res.json()) as PipelinePayload;
      if (!res.ok || body.ok !== true) {
        setErr(body.error ?? "Could not load onboarding pipeline.");
        return;
      }
      setRows(body.data ?? []);
      if (body.counts) setCounts(body.counts);
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load onboarding pipeline."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleRows = useMemo(() => rows.slice(0, 8), [rows]);

  async function startOnboarding() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/onboarding/pipeline/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "start_onboarding",
          employee_list: employeeList,
          roles,
          departments,
          responsibilities,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setErr(body.error ?? "Could not start onboarding.");
        return;
      }
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not start onboarding."));
    } finally {
      setBusy(false);
    }
  }

  async function sendToTech() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/onboarding/pipeline/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "send_to_tech" }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setErr(body.error ?? "Could not send to tech.");
        return;
      }
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not send to tech."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={glass}>
      <p style={metaLabel}>ONBOARDING PIPELINE</p>
      <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>Sales handoff queue</h3>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
        New: {counts.new} · In progress: {counts.in_progress} · Sent to tech: {counts.sent_to_tech} · Completed: {counts.completed}
      </p>
      {err ? <p style={{ fontSize: 12, color: "#fca5a5", margin: "0 0 10px" }}>{err}</p> : null}
      {selected ? (
        <div>
          <button type="button" onClick={() => setSelected(null)} style={linkBtn}>
            ← Back to list
          </button>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>{selected.company_name}</p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            Status: {selected.status.replace(/_/g, " ")}
          </p>
          <label style={fieldLabel}>Employee list</label>
          <textarea value={employeeList} onChange={(e) => setEmployeeList(e.target.value)} rows={2} style={ta} />
          <label style={fieldLabel}>Roles</label>
          <textarea value={roles} onChange={(e) => setRoles(e.target.value)} rows={2} style={ta} />
          <label style={fieldLabel}>Departments</label>
          <textarea value={departments} onChange={(e) => setDepartments(e.target.value)} rows={2} style={ta} />
          <label style={fieldLabel}>Responsibilities</label>
          <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} rows={2} style={ta} />
          <button type="button" disabled={busy} onClick={() => void startOnboarding()} style={btnSecondary}>
            Start Onboarding
          </button>
          <button type="button" disabled={busy} onClick={() => void sendToTech()} style={btnPrimary}>
            Send to Tech
          </button>
        </div>
      ) : visibleRows.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visibleRows.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => setSelected(row)} style={rowBtn}>
                <strong>{row.company_name}</strong>
                <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  {row.status.replace(/_/g, " ")}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                  Owned by: {row.owned_by ? `${row.owned_by.name} (${row.owned_by.role})` : "Unassigned"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>No onboarding accounts assigned yet.</p>
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
  color: "rgba(79,209,255,0.58)",
  margin: "0 0 6px",
};

const rowBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  color: "white",
  marginBottom: 8,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
  cursor: "pointer",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.45)",
};

const ta: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  marginBottom: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.2)",
  color: "white",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  margin: "0 0 8px",
  color: "#4FD1FF",
  cursor: "pointer",
  fontSize: 13,
};

const btnSecondary: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "11px 12px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, rgba(79,209,255,0.35), rgba(124,92,255,0.35))",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};
