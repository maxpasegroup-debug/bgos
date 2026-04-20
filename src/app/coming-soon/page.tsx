import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BGOS — Coming Soon",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#05070A",
        padding: "24px",
        textAlign: "center",
        fontFamily: "var(--font-inter, system-ui, sans-serif)",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "linear-gradient(135deg, #4FD1FF22 0%, #7C5CFF22 100%)",
          border: "1px solid rgba(79,209,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            background: "linear-gradient(135deg, #4FD1FF 0%, #7C5CFF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-1px",
          }}
        >
          B
        </span>
      </div>

      {/* Wordmark */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          marginBottom: 40,
        }}
      >
        BGOS
      </p>

      {/* Divider */}
      <div
        style={{
          width: 40,
          height: 1,
          background: "rgba(79,209,255,0.25)",
          marginBottom: 40,
        }}
      />

      {/* Headline */}
      <h1
        style={{
          fontSize: "clamp(22px, 5vw, 32px)",
          fontWeight: 700,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "-0.5px",
          lineHeight: 1.25,
          marginBottom: 16,
          maxWidth: 480,
        }}
      >
        System upgrading.
        <br />
        <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>
          New dashboards launching soon.
        </span>
      </h1>

      {/* Sub-text */}
      <p
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.28)",
          maxWidth: 360,
          lineHeight: 1.6,
          marginBottom: 48,
        }}
      >
        The backend is fully operational. We are rebuilding the interface for a
        better experience. Check back shortly.
      </p>

      {/* Status pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderRadius: 999,
          border: "1px solid rgba(79,209,255,0.18)",
          background: "rgba(79,209,255,0.06)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#4FD1FF",
            animation: "pulse 2s ease-in-out infinite",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 12, color: "rgba(79,209,255,0.8)", fontWeight: 500 }}>
          Backend online · UI rebuild in progress
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
