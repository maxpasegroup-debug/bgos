"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { AuthUser } from "@/lib/auth";
import { BdmNexaOnboarding } from "./BdmNexaOnboarding";

type LeadRow = {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string | null;
  industry: string | null;
  statusKey: "NEW" | "CONTACTED" | "QUALIFIED" | "ONBOARDING" | "DELIVERED" | "LOST";
  assignedDate: string;
};

type TechRequestRow = {
  id: string;
  companyName: string;
  status: string;
  submittedDate: string;
  estimatedDelivery: string | null;
  sdeAssigned: string | null;
  nextActionNeeded: string | null;
};

export function BdmOnboarding({ user }: { user: AuthUser }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [techRequests, setTechRequests] = useState<TechRequestRow[]>([]);
  const [wizardLead, setWizardLead] = useState<LeadRow | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [leadRes, trRes] = await Promise.all([
        apiFetch("/api/bdm/leads", { credentials: "include" }),
        apiFetch("/api/bdm/tech-requests", { credentials: "include" }),
      ]);
      const leadJson = (await leadRes.json()) as { leads?: LeadRow[]; error?: string };
      const trJson = (await trRes.json()) as { techRequests?: TechRequestRow[]; error?: string };
      if (!leadRes.ok) throw new Error(leadJson.error ?? "Could not load onboarding leads.");
      if (!trRes.ok) throw new Error(trJson.error ?? "Could not load tech requests.");
      setLeads(Array.isArray(leadJson.leads) ? leadJson.leads : []);
      setTechRequests(Array.isArray(trJson.techRequests) ? trJson.techRequests : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load onboarding data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const activeOnboardings = useMemo(
    () => leads.filter((lead) => lead.statusKey === "QUALIFIED" || lead.statusKey === "ONBOARDING"),
    [leads],
  );
  const completedOnboardings = useMemo(
    () => leads.filter((lead) => lead.statusKey === "DELIVERED"),
    [leads],
  );

  function stageArray(leadId: string) {
    const req = techRequests.find((row) => row.id === leadId || row.companyName);
    const hasTech = Boolean(req);
    const isBuilding = req?.status === "IN_PROGRESS" || req?.status === "REVIEW";
    const isDone = req?.status === "DONE";
    return [
      { label: "Lead", done: true },
      { label: "Profile", done: true },
      { label: "Tech Request", done: hasTech },
      { label: "Building", done: isBuilding || isDone },
      { label: "Delivery", done: isDone },
      { label: "Done", done: isDone },
    ];
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={sectionStyle}>
        <h3 style={{ margin: 0, fontSize: 17 }}>ACTIVE ONBOARDINGS</h3>
        {loading ? (
          <p style={mutedText}>Loading...</p>
        ) : error ? (
          <p style={{ ...mutedText, color: "#FCA5A5" }}>{error}</p>
        ) : activeOnboardings.length === 0 ? (
          <p style={mutedText}>No active onboardings.</p>
        ) : (
          activeOnboardings.map((lead) => {
            const days = Math.max(
              1,
              Math.floor((Date.now() - new Date(lead.assignedDate).getTime()) / (1000 * 60 * 60 * 24)),
            );
            const tech = techRequests.find((row) => row.companyName === lead.companyName);
            const stages = stageArray(lead.id);
            return (
              <div key={lead.id} style={cardStyle}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{lead.companyName}</p>
                <p style={mutedText}>Boss contact: {lead.contactName || "Not added yet"}</p>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {stages.map((stage) => (
                    <span
                      key={stage.label}
                      style={{
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontSize: 11,
                        border: `1px solid ${stage.done ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.2)"}`,
                        background: stage.done ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)",
                        color: stage.done ? "#86EFAC" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {stage.label}
                    </span>
                  ))}
                </div>
                <p style={mutedText}>Days since started: {days}</p>
                <p style={mutedText}>SDE assigned: {tech?.sdeAssigned ?? "Not assigned"}</p>
                <p style={mutedText}>
                  Next action needed: {tech?.nextActionNeeded ?? "Complete onboarding and submit the build brief."}
                </p>
                <button type="button" style={buttonStyle} onClick={() => setWizardLead(lead)}>
                  Start Onboarding
                </button>
              </div>
            );
          })
        )}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: 0, fontSize: 17 }}>COMPLETED ONBOARDINGS</h3>
        {loading ? (
          <p style={mutedText}>Loading...</p>
        ) : completedOnboardings.length === 0 ? (
          <p style={mutedText}>No delivered clients yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {completedOnboardings.slice(0, 8).map((lead) => (
              <div key={lead.id} style={cardStyle}>
                <p style={{ margin: 0, fontWeight: 700 }}>{lead.companyName}</p>
                <p style={mutedText}>Delivered on: {new Date(lead.assignedDate).toLocaleDateString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {wizardLead ? (
        <BdmNexaOnboarding
          lead={wizardLead}
          user={user}
          onClose={() => {
            setWizardLead(null);
            void loadData();
          }}
        />
      ) : null}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  padding: "16px",
  display: "grid",
  gap: 10,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  padding: 10,
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
