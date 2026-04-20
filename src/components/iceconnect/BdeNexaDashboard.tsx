"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type DashboardPayload = {
  mission: {
    id: string;
    target_prospects: number;
    completed_count: number;
    calls_logged: number;
    status: string;
    title?: string;
    kind?: string;
    onboarding_day?: number | null;
  };
  tasks: Array<{ id: string; task_text: string; status: string }>;
  streak: { current_streak: number; last_active: string | null };
  rewards: Array<{ id: string; type: string; value: string; status: string }>;
  prospects: Array<{
    id: string;
    company_name: string;
    phone: string;
    location: string | null;
    pipeline_stage: string;
  }>;
  smart_message: string;
};

export function BdeNexaDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ company_name: "", phone: "", location: "" });
  const [assist, setAssist] = useState<"cold" | "follow-up" | "closing">("cold");
  const [assistScript, setAssistScript] = useState<string | null>(null);
  const [revealedRewardIds, setRevealedRewardIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/bde/dashboard", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<DashboardPayload>;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setData({
        mission: j.mission!,
        tasks: j.tasks ?? [],
        streak: j.streak!,
        rewards: j.rewards ?? [],
        prospects: j.prospects ?? [],
        smart_message: j.smart_message ?? "",
      });
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const progressPct = useMemo(() => {
    if (!data) return 0;
    const target = data.mission.target_prospects;
    if (target <= 0) {
      const done = data.tasks.filter((t) => t.status === "done").length;
      const total = Math.max(1, data.tasks.length);
      return Math.min(100, Math.round((done / total) * 100));
    }
    const t = Math.max(1, target);
    return Math.min(100, Math.round((data.mission.completed_count / t) * 100));
  }, [data]);

  async function submitProspect(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim() || !form.phone.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/bde/prospect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name,
          phone: form.phone,
          location: form.location || undefined,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not save");
        return;
      }
      setForm({ company_name: "", phone: "", location: "" });
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/iceconnect/bde/tasks/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function logCall() {
    setBusy(true);
    try {
      await apiFetch("/api/iceconnect/bde/log-call", {
        method: "POST",
        credentials: "include",
      });
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function loadAssist() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/nexa/sales-assist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: assist }),
      });
      const j = (await res.json()) as { ok?: boolean; script?: string; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Nexa assistant is temporarily unavailable.");
        setAssistScript(
          "Use this fallback: ask one clear need, confirm timeline, and propose a short live demo.",
        );
        return;
      }
      setAssistScript(
        j.script ??
          "Use this fallback: ask one clear need, confirm timeline, and propose a short live demo.",
      );
    } catch (e) {
      setErr(formatFetchFailure(e, "Nexa assistant is temporarily unavailable."));
      setAssistScript(
        "Use this fallback: ask one clear need, confirm timeline, and propose a short live demo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revealReward(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/iceconnect/bde/rewards/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      setRevealedRewardIds((prev) => new Set(prev).add(id));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const glass: React.CSSProperties = {
    padding: "16px 18px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  if (err && !data) {
    return <p style={{ color: "#f87171", fontSize: 14 }}>{err}</p>;
  }
  if (!data) {
    return <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Loading Nexa…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <style jsx global>{`
        @keyframes bdeRewardPop {
          0% {
            transform: scale(0.92);
            opacity: 0;
          }
          60% {
            transform: scale(1.03);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      {err ? <p style={{ color: "#f87171", fontSize: 13, marginBottom: 4 }}>{err}</p> : null}

      <div style={{ ...glass, boxShadow: "0 0 40px -12px rgba(79,209,255,0.15)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(79,209,255,0.55)", margin: "0 0 8px" }}>
          NEXA MISSION
        </p>
        <p style={{ fontSize: 13, color: "#a5f3fc", margin: "0 0 8px", lineHeight: 1.45 }}>{data.smart_message}</p>
        <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>
          {data.mission.title ?? "Today's mission"}
        </p>
        {data.mission.target_prospects > 0 ? (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 12px" }}>
            Prospect target: {data.mission.completed_count} / {data.mission.target_prospects}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 12px" }}>
            Complete the checklist below — today is task-focused.
          </p>
        )}
        <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, #4FD1FF, #7C5CFF)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "10px 0 0" }}>
          {data.mission.target_prospects > 0
            ? `${data.mission.completed_count} / ${data.mission.target_prospects} prospects · `
            : ""}
          {data.mission.calls_logged} calls logged
        </p>
      </div>

      <div style={glass}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
          TASKS
        </p>
        {data.tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={busy || t.status === "done"}
            onClick={() => void toggleTask(t.id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: t.status === "done" ? "rgba(255,255,255,0.02)" : "rgba(79,209,255,0.06)",
              color: "white",
              marginBottom: 8,
              fontSize: 14,
              cursor: t.status === "done" ? "default" : "pointer",
            }}
          >
            {t.status === "done" ? "✓ " : ""}
            {t.task_text}
          </button>
        ))}
      </div>

      <div style={glass}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
          QUICK ACTIONS
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => void logCall()} style={qaBtn}>
            Log a call
          </button>
          <a href="tel:" style={{ ...qaBtn, textDecoration: "none", textAlign: "center" }}>
            Call (dialer)
          </a>
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noreferrer"
            style={{ ...qaBtn, textDecoration: "none", textAlign: "center" }}
          >
            WhatsApp
          </a>
        </div>
      </div>

      <form onSubmit={submitProspect} style={glass}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(52,211,153,0.55)", margin: "0 0 10px" }}>
          ADD PROSPECT
        </p>
        <label style={lbl}>Company</label>
        <input
          value={form.company_name}
          onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
          style={inp}
          placeholder="Solar company name"
        />
        <label style={lbl}>Phone</label>
        <input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          style={inp}
          placeholder="+91…"
        />
        <label style={lbl}>Location</label>
        <input
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          style={inp}
          placeholder="City / area"
        />
        <button type="submit" disabled={busy} style={{ ...qaBtn, marginTop: 10, border: "none", cursor: "pointer" }}>
          Save prospect
        </button>
      </form>

      <div style={{ ...glass, borderColor: "rgba(251,191,36,0.25)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(251,191,36,0.7)", margin: "0 0 8px" }}>
          STREAK
        </p>
        <p style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          {data.streak.current_streak} <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>days</span>
        </p>
      </div>

      <div style={{ ...glass, borderColor: "rgba(245,158,11,0.2)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(245,158,11,0.6)", margin: "0 0 8px" }}>
          REWARDS
        </p>
        {data.rewards.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>Add prospects to unlock.</p>
        ) : (
          data.rewards.map((r) => (
            <div key={r.id} style={{ marginBottom: 10 }}>
              {r.status === "unlocked" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revealReward(r.id)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(245,158,11,0.35)",
                    background: "rgba(245,158,11,0.1)",
                    color: "#FBBF24",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Tap to reveal reward
                </button>
              ) : r.status === "revealed" ? (
                <p
                  style={{
                    fontSize: 15,
                    margin: 0,
                    color: "#FDE68A",
                    fontWeight: 700,
                    animation: revealedRewardIds.has(r.id) ? "bdeRewardPop 0.45s ease-out" : undefined,
                  }}
                >
                  {r.value}
                </p>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>Locked — keep adding prospects.</p>
              )}
            </div>
          ))
        )}
      </div>

      <div style={glass}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
          NEXA SALES ASSISTANT
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {(["cold", "follow-up", "closing"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setAssist(s);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: assist === s ? "1px solid #4FD1FF" : "1px solid rgba(255,255,255,0.12)",
                background: assist === s ? "rgba(79,209,255,0.12)" : "transparent",
                color: "white",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button type="button" disabled={busy} onClick={() => void loadAssist()} style={qaBtn}>
          Get script
        </button>
        {assistScript ? (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", margin: "12px 0 0", lineHeight: 1.5 }}>{assistScript}</p>
        ) : null}
      </div>

      <div style={glass}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", margin: 0 }}>
            RECENT PROSPECTS
          </p>
          <Link href="/iceconnect/bde/leads" style={{ fontSize: 12, color: "#4FD1FF" }}>
            Pipeline
          </Link>
        </div>
        {data.prospects.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>No prospects yet today.</p>
        ) : (
          data.prospects.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{p.company_name}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 6px" }}>
                {p.phone}
                {p.location ? ` · ${p.location}` : ""}
              </p>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{p.pipeline_stage}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  marginBottom: 4,
};

const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.2)",
  color: "white",
  fontSize: 15,
  marginBottom: 10,
};

const qaBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 600,
  fontSize: 14,
  fontFamily: "inherit",
};
