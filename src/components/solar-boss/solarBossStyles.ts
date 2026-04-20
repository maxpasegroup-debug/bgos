import type { CSSProperties } from "react";

export const glassCard: CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
};

export const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.22)",
  textTransform: "uppercase" as const,
  margin: "0 0 10px",
};
