export default function RsmLeadsStub() {
  return <Stub text="Regional lead assignments — connect to scoped leads API." />;
}

function Stub({ text }: { text: string }) {
  return (
    <div style={box}>
      <p style={{ fontSize: 14, margin: 0 }}>{text}</p>
    </div>
  );
}

const box: React.CSSProperties = {
  padding: "20px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.85)",
};
