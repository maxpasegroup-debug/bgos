"use client";

import { useState } from "react";
import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

type Exp = { id: string; title: string; amount: number; date: string };

export default function SolarBossExpensesPage() {
  const [rows, setRows] = useState<Exp[]>([
    { id: "1", title: "Transport — site A", amount: 4200, date: "2026-04-18" },
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Expenses</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>Track spend</p>
      </header>

      <button
        type="button"
        onClick={() =>
          setRows((r) => [
            ...r,
            { id: String(Date.now()), title: "New expense", amount: 0, date: new Date().toISOString().slice(0, 10) },
          ])
        }
        style={{
          alignSelf: "flex-start",
          padding: "12px 18px",
          borderRadius: 12,
          border: "1px solid rgba(79,209,255,0.25)",
          background: "rgba(79,209,255,0.1)",
          color: "#4FD1FF",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Add expense
      </button>

      <div>
        <p style={sectionLabel}>Recent</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((e) => (
            <div key={e.id} style={{ ...glassCard, display: "flex", justifyContent: "space-between" }}>
              <span>{e.title}</span>
              <span style={{ fontWeight: 700 }}>₹{e.amount.toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
