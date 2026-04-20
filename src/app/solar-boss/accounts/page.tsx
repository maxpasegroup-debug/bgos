import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

export default function SolarBossAccountsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Accounts</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Money flow — not full accounting
        </p>
      </header>

      <div style={{ display: "grid", gap: 12 }}>
        {[
          { label: "Payments received (MTD)", value: "₹4,28,000", color: "#34D399" },
          { label: "Pending payments", value: "₹62,000", color: "#FBBF24" },
          { label: "Loan cases", value: "3 open", color: "#4FD1FF" },
        ].map((r) => (
          <div key={r.label} style={{ ...glassCard, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}>{r.label}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
        Connect to invoices & payments when you wire real data.
      </p>
    </div>
  );
}
