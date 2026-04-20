"use client";

import { useState } from "react";

type TaskRow = {
  id: string;
  company: string;
  task: string;
  status: "new" | "progress" | "done";
};

const PLACEHOLDER: TaskRow[] = [
  { id: "1", company: "Sunrise Solar", task: "API handoff checklist", status: "new" },
  { id: "2", company: "BlueGrid Energy", task: "Validate monitoring feed", status: "progress" },
  { id: "3", company: "GreenLeaf Rooftop", task: "Close automation loop", status: "done" },
];

/** Mobile tech_exec dashboard — connect to /api/tech/requests */
export function IceconnectTechExecMobileDashboard() {
  const [rows, setRows] = useState<TaskRow[]>(PLACEHOLDER);

  function setStatus(id: string, status: TaskRow["status"]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const pending = rows.filter((r) => r.status === "new").length;
  const progress = rows.filter((r) => r.status === "progress").length;
  const done = rows.filter((r) => r.status === "done").length;

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
        AVG COMPLETION (PLACEHOLDER)
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "#4FD1FF", margin: "0 0 16px" }}>1.4 days</p>

      {rows.map((r) => (
        <div key={r.id} style={card}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 4px" }}>{r.company}</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>{r.task}</p>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background:
                r.status === "done"
                  ? "rgba(52,211,153,0.15)"
                  : r.status === "progress"
                    ? "rgba(79,209,255,0.15)"
                    : "rgba(245,158,11,0.15)",
              color:
                r.status === "done" ? "#34D399" : r.status === "progress" ? "#4FD1FF" : "#F59E0B",
            }}
          >
            {r.status === "new" ? "NEW" : r.status === "progress" ? "IN PROGRESS" : "DONE"}
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {r.status !== "progress" && r.status !== "done" && (
              <button
                type="button"
                onClick={() => setStatus(r.id, "progress")}
                style={btnOutline}
              >
                Start
              </button>
            )}
            {r.status === "progress" && (
              <button
                type="button"
                onClick={() => setStatus(r.id, "done")}
                style={btnPrimary}
              >
                Complete
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
