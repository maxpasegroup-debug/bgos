import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";

export default function SolarBossInventoryPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Inventory</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Panels & inverters — keep counts simple
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Panels (kW)", count: "124" },
          { label: "Inverters", count: "38" },
          { label: "Structures", count: "210" },
        ].map((x) => (
          <div key={x.label} style={glassCard}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>{x.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{x.count}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid rgba(79,209,255,0.25)",
            background: "rgba(79,209,255,0.08)",
            color: "#4FD1FF",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Add stock
        </button>
        <button
          type="button"
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Update
        </button>
      </div>
    </div>
  );
}
