"use client";

import type { CSSProperties } from "react";

function outlineBtn(color: string): CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 10,
    background: `${color}0C`,
    border: `1px solid ${color}28`,
    color,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.01em",
  };
}

export function BgosBossNetworkActions() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <a
        href="/api/internal/team"
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...outlineBtn("#4FD1FF"), textDecoration: "none", display: "inline-block" }}
      >
        View Network →
      </a>
      <button
        type="button"
        onClick={() => alert("Add RSM — connect to POST /api/internal/team")}
        style={outlineBtn("#7C5CFF")}
      >
        Add RSM
      </button>
    </div>
  );
}
