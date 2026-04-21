"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type TechRequestRow = {
  id: string;
  companyName: string;
  submittedDate: string;
  employeeCount: number;
  priority: string;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "DONE";
  sdeNotes: string;
  estimatedDelivery: string | null;
  type: "ONBOARDING" | "SUPPORT" | "ADDITION";
};

const statusColor: Record<TechRequestRow["status"], string> = {
  PENDING: "#F59E0B",
  IN_PROGRESS: "#60A5FA",
  REVIEW: "#A78BFA",
  DONE: "#34D399",
};

export function BdmTechRequests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TechRequestRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/bdm/tech-requests", { credentials: "include" });
        const body = (await res.json()) as { techRequests?: TechRequestRow[]; error?: string };
        if (!res.ok) {
          setError(body.error ?? "Could not load tech requests.");
          setRows([]);
        } else {
          setRows(Array.isArray(body.techRequests) ? body.techRequests : []);
        }
      } catch {
        setError("Could not load tech requests.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        padding: "16px",
        display: "grid",
        gap: 10,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 17 }}>Tech Requests</h3>
      {loading ? <p style={mutedText}>Loading...</p> : null}
      {error ? <p style={{ ...mutedText, color: "#FCA5A5" }}>{error}</p> : null}
      {!loading && !error && rows.length === 0 ? <p style={mutedText}>No tech requests submitted yet.</p> : null}
      {rows.map((row) => (
        <div key={row.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{row.companyName}</p>
              <p style={mutedText}>Submitted: {new Date(row.submittedDate).toLocaleDateString("en-IN")}</p>
              <p style={mutedText}>Employee count: {row.employeeCount}</p>
            </div>
            <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
              <span style={badgeStyle(row.priority === "URGENT" ? "#F87171" : "#9CA3AF")}>{row.priority}</span>
              <span style={badgeStyle(statusColor[row.status])}>{row.status}</span>
            </div>
          </div>
          <p style={mutedText}>SDE notes: {row.sdeNotes || "No updates yet."}</p>
          <p style={mutedText}>Estimated delivery: {row.estimatedDelivery || "Not specified"}</p>
          <button type="button" style={buttonStyle}>
            View Details
          </button>
        </div>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  padding: 10,
  display: "grid",
  gap: 6,
};

const mutedText: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "rgba(255,255,255,0.72)",
};

function badgeStyle(color: string): React.CSSProperties {
  return {
    borderRadius: 999,
    border: `1px solid ${color}66`,
    background: `${color}22`,
    color,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
  };
}

const buttonStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(79,209,255,0.45)",
  background: "rgba(79,209,255,0.14)",
  color: "#9CE7FF",
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};
