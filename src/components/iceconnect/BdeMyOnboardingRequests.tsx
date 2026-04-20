"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Row = {
  id: string;
  company_name: string;
  status: string;
  created_at: string;
};

export function BdeMyOnboardingRequests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/onboarding-requests?scope=mine", { credentials: "include" });
        const j = (await res.json()) as { ok?: boolean; requests?: Row[] };
        if (!cancelled && res.ok && j.ok) setRows(j.requests ?? []);
      } catch (e) {
        if (!cancelled) setErr(formatFetchFailure(e, "Could not load"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const glass: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  if (err) return null;

  return (
    <div style={glass}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", margin: 0 }}>
          MY ONBOARDING REQUESTS
        </p>
        <Link href="/iceconnect/onboard" style={{ fontSize: 12, color: "#4FD1FF", fontWeight: 600 }}>
          + New
        </Link>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>No requests yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.slice(0, 5).map((r) => (
            <li
              key={r.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <span style={{ fontWeight: 600 }}>{r.company_name}</span>
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 4 }}>
                {r.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
