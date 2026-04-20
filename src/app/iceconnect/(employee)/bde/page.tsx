"use client";

import Link from "next/link";
import { BdeOnboardingPipelineSection } from "@/components/iceconnect/BdeOnboardingPipelineSection";
import { BdeGrowingAccountsSection } from "@/components/iceconnect/BdeGrowingAccountsSection";
import { BdeMyOnboardingRequests } from "@/components/iceconnect/BdeMyOnboardingRequests";
import { BdeNexaDashboard } from "@/components/iceconnect/BdeNexaDashboard";

/**
 * BDE home — Nexa daily mission, tasks, streaks, rewards, prospect capture (mobile-first, no tables).
 */
export default function IceconnectBdeHomePage() {
  const glass: React.CSSProperties = {
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <BdeNexaDashboard />

      <BdeMyOnboardingRequests />
      <BdeOnboardingPipelineSection />

      <BdeGrowingAccountsSection />

      <Link href="/iceconnect/sales/control" style={{ textDecoration: "none" }}>
        <div
          style={{
            ...glass,
            marginBottom: 14,
            borderColor: "rgba(124,92,255,0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(124,92,255,0.55)", margin: "0 0 4px" }}>
              SALES CONTROL
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Capacity alerts &amp; actions</p>
          </div>
          <span style={{ color: "#7C5CFF", fontSize: 20 }}>›</span>
        </div>
      </Link>

      <Link href="/iceconnect/sales/report" style={{ textDecoration: "none" }}>
        <div
          style={{
            ...glass,
            marginBottom: 14,
            borderColor: "rgba(52,211,153,0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(52,211,153,0.5)", margin: "0 0 4px" }}>
              SALES REPORT
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Team performance &amp; activity</p>
          </div>
          <span style={{ color: "#34D399", fontSize: 20 }}>›</span>
        </div>
      </Link>

      <Link href="/iceconnect/onboard" style={{ textDecoration: "none" }}>
        <div
          style={{
            ...glass,
            marginBottom: 14,
            borderColor: "rgba(79,209,255,0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(79,209,255,0.5)", margin: "0 0 4px" }}>
              NEXA ONBOARD
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Request a new company setup</p>
          </div>
          <span style={{ color: "#4FD1FF", fontSize: 20 }}>›</span>
        </div>
      </Link>

      <Link href="/iceconnect/bde/wallet" style={{ textDecoration: "none" }}>
        <div style={{ ...glass, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", margin: "0 0 4px" }}>
              WALLET
            </p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#4FD1FF", margin: 0 }}>Earnings</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>Open wallet</p>
          </div>
          <span style={{ color: "#4FD1FF", fontSize: 18 }}>›</span>
        </div>
      </Link>
    </div>
  );
}
