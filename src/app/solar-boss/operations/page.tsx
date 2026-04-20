"use client";

import { useState } from "react";
import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

type Tab = "visits" | "installs" | "eb";
type Row = { id: string; label: string; status: "pending" | "in_progress" | "completed" };

const DATA: Record<Tab, Row[]> = {
  visits: [
    { id: "1", label: "Site — Green Homes", status: "pending" },
    { id: "2", label: "Site — Sunrise Villas", status: "in_progress" },
  ],
  installs: [
    { id: "1", label: "Install — Block A", status: "in_progress" },
    { id: "2", label: "Install — Block B", status: "pending" },
  ],
  eb: [{ id: "1", label: "EB connection — Peak", status: "completed" }],
};

const TABS: { key: Tab; label: string }[] = [
  { key: "visits", label: "Site visits" },
  { key: "installs", label: "Installations" },
  { key: "eb", label: "EB works" },
];

export default function SolarBossOperationsPage() {
  const [tab, setTab] = useState<Tab>("visits");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Operations</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>Execution tracking</p>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: tab === t.key ? "1px solid rgba(79,209,255,0.35)" : "1px solid rgba(255,255,255,0.1)",
              background: tab === t.key ? "rgba(79,209,255,0.1)" : "rgba(255,255,255,0.03)",
              color: tab === t.key ? "#4FD1FF" : "rgba(255,255,255,0.55)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <p style={sectionLabel}>List</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DATA[tab].map((r) => (
            <div
              key={r.id}
              style={{
                ...glassCard,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 15 }}>{r.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    r.status === "completed" ? "#34D399" : r.status === "in_progress" ? "#FBBF24" : "#94A3B8",
                }}
              >
                {r.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
