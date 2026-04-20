"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Phase = "company" | "email" | "type" | "notes" | "confirm" | "done";

const OPTIONS = [
  { value: "solar", label: "Solar" },
  { value: "builder", label: "Builder" },
  { value: "academy", label: "Academy" },
  { value: "custom", label: "Custom" },
] as const;

export function IceconnectNexaOnboardClient() {
  const [phase, setPhase] = useState<Phase>("company");
  const [companyName, setCompanyName] = useState("");
  const [bossEmail, setBossEmail] = useState("");
  const [dashboardType, setDashboardType] = useState<(typeof OPTIONS)[number]["value"]>("solar");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bubble = (mine: boolean, text: string) => (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: "94%",
          padding: "12px 14px",
          borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: mine ? "rgba(79,209,255,0.16)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${mine ? "rgba(79,209,255,0.22)" : "rgba(255,255,255,0.08)"}`,
          fontSize: 15,
          lineHeight: 1.45,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {text}
      </div>
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "16px 18px",
    fontSize: 18,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.28)",
    color: "white",
    outline: "none",
  };

  const btn: React.CSSProperties = {
    width: "100%",
    marginTop: 14,
    padding: "16px 18px",
    fontSize: 17,
    fontWeight: 700,
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(135deg, rgba(79,209,255,0.4) 0%, rgba(124,92,255,0.35) 100%)",
    color: "white",
  };

  async function submit() {
    setErr(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/onboarding/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          company_name: companyName.trim(),
          boss_email: bossEmail.trim(),
          dashboard_type: dashboardType,
          notes: notes.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not submit");
        return;
      }
      setPhase("done");
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "8px 0 40px", maxWidth: 520, margin: "0 auto" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)", margin: "0 0 18px" }}>
        NEXA ONBOARDING
      </p>

      {phase === "company" && (
        <>
          {bubble(false, "Great — let's get this company set up. What's the name?")}
          <input
            aria-label="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name"
            style={inputStyle}
            autoFocus
          />
          <button
            type="button"
            style={{ ...btn, opacity: companyName.trim() ? 1 : 0.45 }}
            disabled={!companyName.trim()}
            onClick={() => setPhase("email")}
          >
            Next
          </button>
        </>
      )}

      {phase === "email" && (
        <>
          {bubble(true, companyName.trim())}
          {bubble(false, "What's the boss email?")}
          <input
            aria-label="Boss email"
            type="email"
            value={bossEmail}
            onChange={(e) => setBossEmail(e.target.value)}
            placeholder="boss@company.com"
            style={inputStyle}
            autoFocus
          />
          <button
            type="button"
            style={{ ...btn, opacity: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bossEmail.trim()) ? 1 : 0.45 }}
            disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bossEmail.trim())}
            onClick={() => setPhase("type")}
          >
            Next
          </button>
        </>
      )}

      {phase === "type" && (
        <>
          {bubble(true, bossEmail.trim())}
          {bubble(false, "Select the business type.")}
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setDashboardType(o.value);
                  setPhase("notes");
                }}
                style={{
                  padding: "18px 20px",
                  borderRadius: 16,
                  textAlign: "left",
                  fontSize: 17,
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "notes" && (
        <>
          {bubble(true, OPTIONS.find((o) => o.value === dashboardType)?.label ?? "")}
          {bubble(false, "Any special requirements? Optional.")}
          <textarea
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short note — integrations, region, timing…"
            rows={3}
            style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontSize: 17 }}
          />
          <button type="button" style={btn} onClick={() => setPhase("confirm")}>
            Continue
          </button>
        </>
      )}

      {phase === "confirm" && (
        <>
          {notes.trim() ? bubble(true, notes.trim()) : bubble(true, "No extra notes")}
          {bubble(false, "Almost done — confirm and we'll route this to Sales.")}
          <div
            style={{
              padding: 18,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 15,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            <p style={{ margin: "0 0 6px" }}>
              <strong>Company</strong> — {companyName}
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong>Boss email</strong> — {bossEmail}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Type</strong> — {OPTIONS.find((o) => o.value === dashboardType)?.label}
            </p>
          </div>
          {err ? <p style={{ color: "#f87171", fontSize: 14, marginTop: 10 }}>{err}</p> : null}
          <button type="button" style={{ ...btn, opacity: submitting ? 0.75 : 1 }} disabled={submitting} onClick={() => void submit()}>
            {submitting ? "Sending…" : "Submit request"}
          </button>
        </>
      )}

      {phase === "done" && (
        <>
          {bubble(false, "Your request is now under review. We'll move fast.")}
          <Link
            href="/iceconnect/bde"
            style={{
              display: "block",
              marginTop: 18,
              textAlign: "center",
              padding: "16px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.06)",
              color: "#4FD1FF",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 16,
            }}
          >
            Back to BDE home
          </Link>
        </>
      )}
    </div>
  );
}
