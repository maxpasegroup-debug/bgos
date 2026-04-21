"use client";

import { useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { BdmClients } from "./bdm/BdmClients";
import { BdmLeads } from "./bdm/BdmLeads";
import { BdmOnboarding } from "./bdm/BdmOnboarding";
import { BdmOverview } from "./bdm/BdmOverview";
import { BdmTechRequests } from "./bdm/BdmTechRequests";

type TabKey = "overview" | "leads" | "onboarding" | "clients" | "tech";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "leads", label: "My Leads" },
  { key: "onboarding", label: "Onboarding" },
  { key: "clients", label: "Clients" },
  { key: "tech", label: "Tech Requests" },
];

export function BdmDashboard({ user }: { user: AuthUser }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const tabContent = useMemo(() => {
    if (activeTab === "overview") return <BdmOverview />;
    if (activeTab === "leads") return <BdmLeads user={user} />;
    if (activeTab === "onboarding") return <BdmOnboarding />;
    if (activeTab === "clients") return <BdmClients />;
    return <BdmTechRequests />;
  }, [activeTab, user]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: 10,
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                borderRadius: 10,
                border: active ? "1px solid rgba(79,209,255,0.45)" : "1px solid rgba(255,255,255,0.12)",
                background: active ? "rgba(79,209,255,0.12)" : "rgba(255,255,255,0.04)",
                color: active ? "#9CE7FF" : "rgba(255,255,255,0.85)",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabContent}
    </div>
  );
}
