"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type LeadRow = {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  industry: string | null;
  statusKey: "NEW" | "CONTACTED" | "QUALIFIED" | "ONBOARDING" | "DELIVERED" | "LOST";
  assignedDate: string;
};

export function BdmClients() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportLeadId, setSupportLeadId] = useState<string | null>(null);
  const [addEmployeeLeadId, setAddEmployeeLeadId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [supportPriority, setSupportPriority] = useState("Normal");
  const [miniEmployee, setMiniEmployee] = useState({ name: "", role: "", department: "", responsibilities: "" });

  const clients = useMemo(() => leads.filter((lead) => lead.statusKey === "DELIVERED"), [leads]);

  async function loadClients() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/bdm/leads", { credentials: "include" });
      const body = (await res.json()) as { leads?: LeadRow[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not load clients.");
        setLeads([]);
      } else {
        setLeads(Array.isArray(body.leads) ? body.leads : []);
      }
    } catch {
      setError("Could not load clients.");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function submitSupportRequest(lead: LeadRow) {
    const res = await apiFetch("/api/bdm/tech-requests", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        companyName: lead.companyName,
        industry: lead.industry ?? "Unknown",
        employeeCount: 0,
        employees: [],
        priority: supportPriority,
        notes: issueDescription,
        estimatedDelivery: "",
        type: "SUPPORT",
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "Could not create support request.");
      return;
    }
    setSupportLeadId(null);
    setIssueDescription("");
  }

  async function submitAddEmployeeRequest(lead: LeadRow) {
    const res = await apiFetch("/api/bdm/tech-requests", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        companyName: lead.companyName,
        industry: lead.industry ?? "Unknown",
        employeeCount: 1,
        employees: [{ ...miniEmployee, featuresNeeded: [] }],
        priority: "Normal",
        notes: "Additional employee dashboard request",
        estimatedDelivery: "",
        type: "ADDITION",
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "Could not create add-employee request.");
      return;
    }
    setAddEmployeeLeadId(null);
    setMiniEmployee({ name: "", role: "", department: "", responsibilities: "" });
  }

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
      <h3 style={{ margin: 0, fontSize: 17 }}>Clients</h3>
      {loading ? <p style={mutedText}>Loading...</p> : null}
      {error ? <p style={{ ...mutedText, color: "#FCA5A5" }}>{error}</p> : null}
      {!loading && !error && clients.length === 0 ? <p style={mutedText}>No delivered clients to manage yet.</p> : null}
      {clients.map((client) => (
        <div key={client.id} style={cardStyle}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {client.companyName} {client.industry ? `· ${client.industry}` : ""}
          </p>
          <p style={mutedText}>Boss: {client.contactName} · {client.phone}</p>
          <p style={mutedText}>Delivery date: {new Date(client.assignedDate).toLocaleDateString("en-IN")}</p>
          <p style={mutedText}>Account status: Active</p>
          <p style={mutedText}>Last contact date: {new Date(client.assignedDate).toLocaleDateString("en-IN")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a href={`tel:${client.phone}`} style={{ ...buttonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Call
            </a>
            <button type="button" style={buttonStyle} onClick={() => setSupportLeadId(client.id)}>Support Request</button>
            <button type="button" style={buttonStyle} onClick={() => setAddEmployeeLeadId(client.id)}>Add Employee</button>
          </div>
        </div>
      ))}

      {supportLeadId ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h4 style={{ margin: 0 }}>Support Request</h4>
            <label style={labelStyle}>
              Issue description
              <textarea style={textareaStyle} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Priority
              <select style={inputStyle} value={supportPriority} onChange={(e) => setSupportPriority(e.target.value)}>
                <option>Normal</option>
                <option>Urgent</option>
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={buttonStyle} onClick={() => setSupportLeadId(null)}>Cancel</button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  const lead = clients.find((x) => x.id === supportLeadId);
                  if (lead) void submitSupportRequest(lead);
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addEmployeeLeadId ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h4 style={{ margin: 0 }}>Add Employee</h4>
            <label style={labelStyle}>Full name<input style={inputStyle} value={miniEmployee.name} onChange={(e) => setMiniEmployee((s) => ({ ...s, name: e.target.value }))} /></label>
            <label style={labelStyle}>Role/Position<input style={inputStyle} value={miniEmployee.role} onChange={(e) => setMiniEmployee((s) => ({ ...s, role: e.target.value }))} /></label>
            <label style={labelStyle}>Department<input style={inputStyle} value={miniEmployee.department} onChange={(e) => setMiniEmployee((s) => ({ ...s, department: e.target.value }))} /></label>
            <label style={labelStyle}>Responsibilities<textarea style={textareaStyle} value={miniEmployee.responsibilities} onChange={(e) => setMiniEmployee((s) => ({ ...s, responsibilities: e.target.value }))} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={buttonStyle} onClick={() => setAddEmployeeLeadId(null)}>Cancel</button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  const lead = clients.find((x) => x.id === addEmployeeLeadId);
                  if (lead) void submitAddEmployeeRequest(lead);
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.66)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 75,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 540,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0F172A",
  padding: 14,
  display: "grid",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  padding: "8px 10px",
  fontFamily: "inherit",
  fontSize: 13,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 70,
};
