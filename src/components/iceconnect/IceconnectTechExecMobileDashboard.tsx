"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type TaskRow = {
  id: string;
  company: string;
  task: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "pending" | "in_progress" | "done";
};

type RequestsResponse = {
  ok?: boolean;
  error?: string;
  requests?: Array<{
    id: string;
    roleName: string;
    description: string | null;
    companyName: string | null;
    priority: "HIGH" | "MEDIUM" | "LOW";
    status: "pending" | "in_progress" | "done";
  }>;
};

/** Mobile tech_exec dashboard — live tasks from `/api/tech/requests`. */
export function IceconnectTechExecMobileDashboard() {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/tech/requests", { credentials: "include" });
      const data = (await res.json()) as RequestsResponse;
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Could not load tech tasks.");
        return;
      }
      const mapped = (data.requests ?? []).map((r) => ({
        id: r.id,
        company: r.companyName ?? "Unassigned company",
        task: r.description?.trim() || r.roleName,
        priority: r.priority,
        status: r.status,
      }));
      setRows(mapped);
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load tech tasks."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: TaskRow["status"]) {
    setBusy(id);
    setErr(null);
    try {
      const res = await apiFetch("/api/tech/requests", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Could not update task status.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not update task status."));
    } finally {
      setBusy(null);
    }
  }

  const pending = rows.filter((r) => r.status === "pending").length;
  const progress = rows.filter((r) => r.status === "in_progress").length;
  const done = rows.filter((r) => r.status === "done").length;
  const avgCompletionLabel = useMemo(() => {
    if (rows.length === 0) return "No completed tasks yet";
    const pct = Math.round((done / rows.length) * 100);
    return `${pct}% completed`;
  }, [done, rows.length]);

  const card: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 10,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Pending", value: pending, color: "#F59E0B" },
          { label: "In progress", value: progress, color: "#4FD1FF" },
          { label: "Completed", value: done, color: "#34D399" },
        ].map((s) => (
          <div key={s.label} style={{ ...card, marginBottom: 0, textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: "0 0 4px" }}>{s.value}</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: 0 }}>
        COMPLETION SNAPSHOT
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "#4FD1FF", margin: "0 0 16px" }}>{avgCompletionLabel}</p>

      {err ? <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{err}</p> : null}

      {rows.length === 0 ? (
        <div style={card}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>No tech requests assigned yet.</p>
        </div>
      ) : null}

      {rows.map((r) => (
        <div key={r.id} style={card}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 4px" }}>{r.company}</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>{r.task}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 8px" }}>
            Priority: {r.priority}
          </p>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background:
                r.status === "done"
                  ? "rgba(52,211,153,0.15)"
                  : r.status === "in_progress"
                    ? "rgba(79,209,255,0.15)"
                    : "rgba(245,158,11,0.15)",
              color:
                r.status === "done" ? "#34D399" : r.status === "in_progress" ? "#4FD1FF" : "#F59E0B",
            }}
          >
            {r.status === "pending" ? "PENDING" : r.status === "in_progress" ? "IN PROGRESS" : "DONE"}
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {r.status !== "in_progress" && r.status !== "done" && (
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => void setStatus(r.id, "in_progress")}
                style={btnOutline}
              >
                {busy === r.id ? "Updating..." : "Start"}
              </button>
            )}
            {r.status === "in_progress" && (
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => void setStatus(r.id, "done")}
                style={btnPrimary}
              >
                {busy === r.id ? "Updating..." : "Complete"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const btnOutline: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(79,209,255,0.25)",
  background: "rgba(79,209,255,0.08)",
  color: "#4FD1FF",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  ...btnOutline,
  background: "linear-gradient(135deg, rgba(79,209,255,0.2), rgba(124,92,255,0.2))",
};
