import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

export default function SolarBossHrPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>HR</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Light attendance & leave — not a full HR suite
        </p>
      </header>

      <div>
        <p style={sectionLabel}>Attendance</p>
        <div style={glassCard}>
          <p style={{ margin: 0, fontSize: 15 }}>Today: 18 / 22 present</p>
        </div>
      </div>

      <div>
        <p style={sectionLabel}>Leave requests</p>
        <div style={{ ...glassCard, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Ravi K. — 2 days</span>
          <button
            type="button"
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(52,211,153,0.3)",
              background: "rgba(52,211,153,0.1)",
              color: "#34D399",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Review
          </button>
        </div>
      </div>
    </div>
  );
}
