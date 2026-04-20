"use client";

/** BDM dashboard — mid-level team control (placeholder). */
export default function BdmHomePage() {
  const glass: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 10,
  };

  const bdes = [
    { name: "Arjun", pts: 14, status: "On track" },
    { name: "Meera", pts: 9, status: "Nudge" },
    { name: "Karan", pts: 18, status: "Star" },
  ];

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "0 0 10px" }}>
        TEAM (BDE)
      </p>
      {bdes.map((b) => (
        <div key={b.name} style={glass}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>{b.name}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{b.status}</span>
          </div>
          <p style={{ fontSize: 12, color: "#4FD1FF", margin: "6px 0 0" }}>{b.pts} pts</p>
        </div>
      ))}

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "16px 0 10px" }}>
        PERFORMANCE SUMMARY
      </p>
      <div style={glass}>
        <p style={{ fontSize: 13, margin: 0 }}>Team at 87% of monthly target (placeholder)</p>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "16px 0 10px" }}>
        TEAM EARNINGS
      </p>
      <div style={glass}>
        <p style={{ fontSize: 20, fontWeight: 800, color: "#4FD1FF", margin: 0 }}>₹4.2L</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "6px 0 0" }}>No breakdown — summary only</p>
      </div>

      <button
        type="button"
        style={{
          width: "100%",
          marginTop: 12,
          padding: "14px",
          borderRadius: 14,
          border: "1px solid rgba(124,92,255,0.35)",
          background: "rgba(124,92,255,0.12)",
          color: "#C4B5FD",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
        onClick={() => alert("Invite BDE — wire API")}
      >
        + Add BDE
      </button>
    </div>
  );
}
