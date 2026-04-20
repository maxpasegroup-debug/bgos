export default function BdeProfilePage() {
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p style={{ fontSize: 14, margin: "0 0 8px" }}>Profile</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
        Settings and account details — connect to /api/auth/me + user preferences.
      </p>
    </div>
  );
}
