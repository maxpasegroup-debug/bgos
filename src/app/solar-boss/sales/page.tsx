"use client";

import { useState } from "react";
import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

type Lead = { id: string; name: string; phone: string; status: "new" | "site_visit" | "quote" | "won" };

const DEMO: Lead[] = [
  { id: "1", name: "Green Homes", phone: "+91 98765 43210", status: "new" },
  { id: "2", name: "Sunrise Villas", phone: "+91 91234 56780", status: "site_visit" },
  { id: "3", name: "Peak Industries", phone: "+91 99887 76655", status: "quote" },
];

const STATUS_COLOR: Record<Lead["status"], string> = {
  new: "#4FD1FF",
  site_visit: "#A78BFA",
  quote: "#FBBF24",
  won: "#34D399",
};

export default function SolarBossSalesPage() {
  const [leads, setLeads] = useState(DEMO);

  function cycleStatus(id: string) {
    const order: Lead["status"][] = ["new", "site_visit", "quote", "won"];
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const i = order.indexOf(l.status);
        return { ...l, status: order[(i + 1) % order.length] };
      }),
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Sales</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Leads and deals — wire to `/api/leads` when ready
        </p>
      </header>

      <button
        type="button"
        onClick={() =>
          setLeads((p) => [
            ...p,
            {
              id: String(Date.now()),
              name: "New lead",
              phone: "+91 90000 00000",
              status: "new",
            },
          ])
        }
        style={{
          alignSelf: "flex-start",
          padding: "12px 18px",
          borderRadius: 12,
          border: "1px solid rgba(79,209,255,0.3)",
          background: "rgba(79,209,255,0.12)",
          color: "#4FD1FF",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Add lead
      </button>

      <div>
        <p style={sectionLabel}>Pipeline</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leads.map((l) => (
            <div key={l.id} style={glassCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{l.name}</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>{l.phone}</p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: STATUS_COLOR[l.status],
                    }}
                  >
                    {l.status.replace("_", " ")}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a
                    href={`tel:${l.phone}`}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(79,209,255,0.12)",
                      color: "#4FD1FF",
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: "center",
                      textDecoration: "none",
                    }}
                  >
                    Call
                  </a>
                  <button
                    type="button"
                    onClick={() => cycleStatus(l.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: "white",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Update status
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
