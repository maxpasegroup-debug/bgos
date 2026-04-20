"use client";

import Link from "next/link";
import { RsmOnboardingControlSection } from "@/components/iceconnect/RsmOnboardingControlSection";
import { RsmUsageOverviewPanel } from "@/components/iceconnect/RsmUsageOverviewPanel";

/** RSM dashboard — territory metrics + capacity overview */
export default function RsmHomePage() {
  const glass: React.CSSProperties = {
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  return (
    <div>
      <RsmUsageOverviewPanel />
      <RsmOnboardingControlSection />

      <Link href="/iceconnect/sales/report" style={{ textDecoration: "none", color: "inherit" }}>
        <div
          style={{
            ...glass,
            marginBottom: 14,
            borderColor: "rgba(52,211,153,0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(52,211,153,0.55)", margin: "0 0 4px" }}>
              SALES REPORT
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>BDE performance &amp; conversion</p>
          </div>
          <span style={{ color: "#34D399", fontSize: 20 }}>›</span>
        </div>
      </Link>

      <Link href="/iceconnect/sales/control" style={{ textDecoration: "none", color: "inherit" }}>
        <div
          style={{
            ...glass,
            borderColor: "rgba(79,209,255,0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(79,209,255,0.55)", margin: "0 0 4px" }}>
              SALES CONTROL
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>All capacity alerts &amp; actions</p>
          </div>
          <span style={{ color: "#4FD1FF", fontSize: 20 }}>›</span>
        </div>
      </Link>

      <div style={{ ...glass, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>BDMs</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#7C5CFF", margin: 0 }}>11</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>BDEs</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#4FD1FF", margin: 0 }}>32</p>
        </div>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "0 0 10px" }}>
        PERFORMANCE
      </p>
      <div style={glass}>
        <p style={{ fontSize: 13, color: "#34D399", margin: "0 0 8px" }}>Top: Riya · 118% target</p>
        <p style={{ fontSize: 13, color: "#F59E0B", margin: 0 }}>Low: West zone · 62% target</p>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "0 0 10px" }}>
        ACTIONS
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Link href="/iceconnect/sales/onboarding" style={{ ...btn(), textDecoration: "none", textAlign: "center" }}>
          Add BDE
        </Link>
        <Link href="/iceconnect/sales/control" style={{ ...btn(), textDecoration: "none", textAlign: "center" }}>
          Assign leads
        </Link>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "0 0 10px" }}>
        CAMPAIGN (DAILY TARGET)
      </p>
      <div style={glass}>
        <p style={{ fontSize: 13, margin: 0 }}>Set team push: placeholder ₹50K / day</p>
      </div>
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px",
    borderRadius: 12,
    border: "1px solid rgba(79,209,255,0.25)",
    background: "rgba(79,209,255,0.08)",
    color: "#4FD1FF",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
