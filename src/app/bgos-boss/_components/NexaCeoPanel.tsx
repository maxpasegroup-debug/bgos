"use client";

const ALERT_STYLE = {
  warn: { dot: "#F59E0B", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.18)" },
  action: { dot: "#EF4444", bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.18)" },
  info: { dot: "#4FD1FF", bg: "rgba(79,209,255,0.06)", border: "rgba(79,209,255,0.18)" },
};

export type NexaCeoPanelProps = {
  revenueLabel: string;
  growthLabel: string;
  growthPositive: boolean;
  periodLabel?: string;
  alerts: { id: string; type: "warn" | "action" | "info"; text: string }[];
};

export function NexaCeoPanel({
  revenueLabel,
  growthLabel,
  growthPositive,
  periodLabel = "This month",
  alerts,
}: NexaCeoPanelProps) {
  function handleCampaign() {
    alert("Launch Campaign — connect to /api/bgos/control/performance-engine");
  }
  function handleAnnouncement() {
    alert("Send Announcement — connect to /api/nexa/announcements");
  }

  return (
    <div
      style={{
        borderRadius: 20,
        padding: "28px 32px",
        background: "rgba(10,13,20,0.9)",
        border: "1px solid rgba(79,209,255,0.14)",
        boxShadow: "0 0 64px -20px rgba(79,209,255,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              {periodLabel}
            </p>
            <p
              style={{
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-1.5px",
                color: "rgba(255,255,255,0.95)",
                margin: 0,
              }}
            >
              {revenueLabel}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>Total Revenue</p>
          </div>

          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 40 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              vs prior 30 days
            </p>
            <p
              style={{
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: "-1.5px",
                color: growthPositive ? "#34D399" : "#EF4444",
                margin: 0,
              }}
            >
              {growthLabel}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>Growth</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingTop: 4 }}>
          <button
            type="button"
            onClick={handleAnnouncement}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.75)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.1px",
            }}
          >
            Send Announcement
          </button>
          <button
            type="button"
            onClick={handleCampaign}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(79,209,255,0.18) 0%, rgba(124,92,255,0.18) 100%)",
              border: "1px solid rgba(79,209,255,0.25)",
              color: "#4FD1FF",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.1px",
            }}
          >
            Launch Campaign
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.18)",
              textTransform: "uppercase",
              margin: "0 0 4px",
            }}
          >
            Nexa Alerts
          </p>
          {alerts.map((a) => {
            const s = ALERT_STYLE[a.type];
            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: s.dot,
                    flexShrink: 0,
                  }}
                />
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.4 }}>{a.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
