import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

export default function SolarBossServicesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Services</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
          After-sales — complaints & maintenance
        </p>
      </header>

      <div>
        <p style={sectionLabel}>Complaints</p>
        <div style={{ ...glassCard, marginBottom: 12 }}>
          <p style={{ margin: "0 0 12px", fontSize: 15 }}>Inverter noise — Customer #1042</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: "rgba(52,211,153,0.2)",
                color: "#34D399",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Mark resolved
            </button>
            <button
              type="button"
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "white",
                cursor: "pointer",
              }}
            >
              Assign
            </button>
          </div>
        </div>
      </div>

      <div>
        <p style={sectionLabel}>Maintenance</p>
        <div style={glassCard}>
          <p style={{ margin: 0, fontSize: 15 }}>Annual clean — 3 sites due this week</p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            Connect to service tickets / CRM
          </p>
        </div>
      </div>
    </div>
  );
}
