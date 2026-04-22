"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type LeadFilter = "ALL" | "NEW" | "CONTACTED" | "QUALIFIED" | "ONBOARDING" | "DELIVERED" | "LOST";

type LeadRow = {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string | null;
  industry: string | null;
  status: string;
  statusKey: LeadFilter;
  assignedDate: string;
  lastActivityDate: string | null;
  nextAction: string;
  notes: string | null;
  source?: string | null;
};

const FILTERS: LeadFilter[] = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "ONBOARDING", "DELIVERED", "LOST"];

const STATUS_COLORS: Record<LeadFilter, string> = {
  ALL: "rgba(255,255,255,0.25)",
  NEW: "#9CA3AF",
  CONTACTED: "#60A5FA",
  QUALIFIED: "#A78BFA",
  ONBOARDING: "#F59E0B",
  DELIVERED: "#34D399",
  LOST: "#F87171",
};

type NewLeadPayload = {
  companyName: string;
  industry: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  source: string;
};

const emptyLeadForm: NewLeadPayload = {
  companyName: "",
  industry: "Solar",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
  source: "Website",
};

function toDisplayStatus(statusKey: LeadFilter) {
  if (statusKey === "NEW") return "New";
  if (statusKey === "CONTACTED") return "Contacted";
  if (statusKey === "QUALIFIED") return "Qualified";
  if (statusKey === "ONBOARDING") return "Onboarding";
  if (statusKey === "DELIVERED") return "Delivered";
  if (statusKey === "LOST") return "Lost";
  return "Lead";
}

export function BdmLeads({ user }: { user: { companyId?: string | null } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<LeadFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewLeadPayload>(emptyLeadForm);
  const [saving, setSaving] = useState(false);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/bdm/leads", { credentials: "include" });
      const body = (await res.json()) as { leads?: LeadRow[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not load leads.");
        setLeads([]);
      } else {
        setLeads(Array.isArray(body.leads) ? body.leads : []);
      }
    } catch {
      setError("Could not load leads.");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    if (activeFilter === "ALL") return leads;
    return leads.filter((lead) => lead.statusKey === activeFilter);
  }, [leads, activeFilter]);

  const websiteSignupLeads = useMemo(
    () => leads.filter((lead) => lead.source === "WEBSITE" && lead.statusKey === "NEW"),
    [leads],
  );

  async function submitNewLead() {
    if (!form.companyName.trim() || !form.contactName.trim() || !form.phone.trim() || !form.industry.trim()) {
      setError("Company name, contact person, phone, and industry are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/bdm/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not create lead.");
      } else {
        setForm(emptyLeadForm);
        setModalOpen(false);
        await loadLeads();
      }
    } catch {
      setError("Could not create lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>My Leads</h3>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(79,209,255,0.45)",
              background: "rgba(79,209,255,0.14)",
              color: "#9CE7FF",
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + New Lead
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {websiteSignupLeads.length > 0 ? (
            <div
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid rgba(34,211,238,0.45)",
                background: "rgba(34,211,238,0.1)",
                padding: "10px 12px",
                display: "grid",
                gap: 8,
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#67E8F9" }}>🔔 New Website Signups ({websiteSignupLeads.length})</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.86)" }}>
                  These leads signed up directly and are waiting for your contact.
                </p>
              </div>
              {websiteSignupLeads.map((lead) => (
                <div
                  key={`website-${lead.id}`}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(34,211,238,0.35)",
                    background: "rgba(34,211,238,0.08)",
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{lead.companyName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
                      {lead.contactName} • {lead.phone}
                    </p>
                  </div>
                  <a href={`tel:${lead.phone}`} style={{ color: "#9CE7FF", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                    Call now
                  </a>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTERS.map((filter) => {
            const active = filter === activeFilter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                style={{
                  borderRadius: 999,
                  border: active ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.15)",
                  background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: "white",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {filter === "ALL" ? "All" : toDisplayStatus(filter)}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {error ? (
        <p style={{ margin: 0, color: "#FCA5A5", fontSize: 13 }} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", padding: 16 }}>Loading leads...</div>
      ) : filteredLeads.length === 0 ? (
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", padding: 16 }}>
          <p style={{ margin: 0 }}>
            No leads yet. Click + New Lead to add one or wait for website leads to be assigned.
          </p>
        </div>
      ) : (
        filteredLeads.map((lead) => (
          <div
            key={lead.id}
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{lead.companyName}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{lead.contactName}</p>
                <a
                  href={`tel:${lead.phone}`}
                  style={{ display: "inline-block", marginTop: 4, color: "#9CE7FF", fontWeight: 700, textDecoration: "none" }}
                >
                  {lead.phone}
                </a>
              </div>
              <span
                style={{
                  borderRadius: 999,
                  border: `1px solid ${STATUS_COLORS[lead.statusKey]}66`,
                  background: `${STATUS_COLORS[lead.statusKey]}22`,
                  color: STATUS_COLORS[lead.statusKey],
                  padding: "4px 9px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {toDisplayStatus(lead.statusKey)}
              </span>
            </div>

            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Industry: {lead.industry ?? "—"}</p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Assigned: {new Date(lead.assignedDate).toLocaleDateString("en-IN")}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Last activity: {lead.lastActivityDate ? new Date(lead.lastActivityDate).toLocaleDateString("en-IN") : "—"}
              </p>
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
              Next action: {lead.nextAction || "Not set"}
            </p>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={actionBtnStyle}>View</button>
              <button type="button" style={actionBtnStyle}>Update Status</button>
              <button type="button" style={actionBtnStyle}>Start Onboarding</button>
            </div>
          </div>
        ))
      )}

      {modalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0F172A",
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 18 }}>New Lead</h4>
            <label style={labelStyle}>Company Name *<input style={inputStyle} value={form.companyName} onChange={(e) => setForm((s) => ({ ...s, companyName: e.target.value }))} /></label>
            <label style={labelStyle}>
              Industry *
              <select style={inputStyle} value={form.industry} onChange={(e) => setForm((s) => ({ ...s, industry: e.target.value }))}>
                <option>Solar</option>
                <option>Real Estate</option>
                <option>Retail</option>
                <option>Restaurant</option>
                <option>Custom</option>
              </select>
            </label>
            <label style={labelStyle}>Contact Person Name *<input style={inputStyle} value={form.contactName} onChange={(e) => setForm((s) => ({ ...s, contactName: e.target.value }))} /></label>
            <label style={labelStyle}>Phone Number *<input style={inputStyle} value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></label>
            <label style={labelStyle}>Email<input style={inputStyle} value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></label>
            <label style={labelStyle}>Notes<textarea style={{ ...inputStyle, minHeight: 74 }} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></label>
            <label style={labelStyle}>
              Source
              <select style={inputStyle} value={form.source} onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))}>
                <option>Website</option>
                <option>Direct</option>
                <option>Referral</option>
                <option>Cold Call</option>
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={actionBtnStyle}>Cancel</button>
              <button type="button" disabled={saving || !user.companyId} onClick={() => void submitNewLead()} style={primaryBtnStyle}>
                {saving ? "Saving..." : "Create Lead"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const actionBtnStyle: CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryBtnStyle: CSSProperties = {
  ...actionBtnStyle,
  border: "1px solid rgba(79,209,255,0.45)",
  background: "rgba(79,209,255,0.14)",
  color: "#9CE7FF",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: "rgba(255,255,255,0.85)",
};

const inputStyle: CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  padding: "8px 10px",
  fontFamily: "inherit",
  fontSize: 13,
};
