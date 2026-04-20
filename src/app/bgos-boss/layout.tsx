/**
 * BGOS Boss layout — clean CEO shell.
 * No sidebar. No menus. Just a fixed top bar + scrollable content.
 */
import { headers } from "next/headers";
import { AUTH_HEADER_USER_EMAIL } from "@/lib/auth-config";
import type { ReactNode } from "react";

export default async function BgosBossLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const email = hdrs.get(AUTH_HEADER_USER_EMAIL) ?? "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070A",
        fontFamily: "var(--font-inter, system-ui, sans-serif)",
        color: "rgba(255,255,255,0.9)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "rgba(5,7,10,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Left — wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            BGOS
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase",
              paddingTop: 1,
            }}
          >
            BOSS
          </span>
        </div>

        {/* Right — live status + email */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Live pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.18)",
            }}
          >
            <LiveDot />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(52,211,153,0.9)",
                letterSpacing: "0.04em",
              }}
            >
              Live
            </span>
          </div>

          {/* Email chip */}
          {email && (
            <div
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  fontWeight: 500,
                }}
              >
                {email}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          marginTop: 56,
          padding: "36px 32px 48px",
          maxWidth: 1080,
          width: "100%",
          margin: "56px auto 0",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}

// Animated pulsing dot — inline so no extra files needed.
function LiveDot() {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 6,
        height: 6,
      }}
    >
      {/* Pulse ring */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "rgba(52,211,153,0.45)",
          animation: "bgos-boss-ping 1.6s ease-out infinite",
        }}
      />
      {/* Solid dot */}
      <span
        style={{
          position: "relative",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#34D399",
          display: "inline-block",
        }}
      />
      <style>{`
        @keyframes bgos-boss-ping {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </span>
  );
}
