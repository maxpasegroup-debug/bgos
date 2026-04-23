"use client";
import type { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  padding: "14px 16px",
};

export function BdmOverview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Total Leads (this month)</p>
          <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800 }}>24</p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Active Onboardings</p>
          <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800 }}>7</p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Delivered Clients</p>
          <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800 }}>12</p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Pending Tech Requests</p>
          <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800 }}>3</p>
        </div>
      </div>

      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", color: "#9CE7FF", fontWeight: 700 }}>
          NEXA BRIEFING
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
          Today&apos;s priorities for your franchise pipeline
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>
          Focus on your 3 pending leads. 2 onboardings need follow-up. 1 tech request is ready for delivery.
        </p>
      </div>

      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
          RECENT ACTIVITY
        </p>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>New lead assigned: Solar Company XYZ</li>
          <li>Onboarding completed: ABC Corp</li>
          <li>Tech request submitted: DEF Ltd</li>
          <li>Follow-up call done: GHI Ventures</li>
          <li>Client training scheduled: JKL Group</li>
        </ul>
      </div>
    </div>
  );
}
