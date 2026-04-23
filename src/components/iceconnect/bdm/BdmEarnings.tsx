"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type EarningsPayload = {
  currentMonth: {
    month: string;
    direct: number;
    recurring: number;
    enterprise: number;
    total: number;
    status: "PENDING" | "APPROVED" | "PAID";
  };
  breakdown: Array<{
    id: string;
    type: string;
    plan: string;
    amount: number;
    clientName: string;
    month: string;
    status: "PENDING" | "APPROVED" | "PAID";
    createdAt: string;
  }>;
  history: Array<{
    month: string;
    direct: number;
    recurring: number;
    enterprise: number;
    total: number;
    status: "PENDING" | "APPROVED" | "PAID";
  }>;
  stats: {
    totalEarned: number;
    totalPaid: number;
    pendingAmount: number;
    activeClients: number;
    topMonth: {
      month: string;
      amount: number;
    };
  };
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(month: string): string {
  const [year, monthPart] = month.split("-");
  const parsed = new Date(Number(year), Number(monthPart) - 1, 1);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function statusTone(status: string): CSSProperties {
  if (status === "PAID") {
    return { color: "#86EFAC", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.28)" };
  }
  if (status === "APPROVED") {
    return { color: "#FDE68A", background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.28)" };
  }
  return { color: "#FCA5A5", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)" };
}

export function BdmEarnings() {
  const [data, setData] = useState<EarningsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/bdm/earnings", { credentials: "include" });
        const body = (await res.json()) as EarningsPayload & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load earnings.");
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load earnings.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "This Month", value: formatCurrency(data.currentMonth.total) },
      { label: "Recurring Bonuses", value: formatCurrency(data.currentMonth.recurring) },
      { label: "Pending Approval", value: formatCurrency(data.stats.pendingAmount) },
      { label: "All Time Earned", value: formatCurrency(data.stats.totalEarned) },
    ];
  }, [data]);

  if (loading) {
    return <div style={panelStyle}>Loading earnings...</div>;
  }

  if (error || !data) {
    return <div style={{ ...panelStyle, color: "#FCA5A5" }}>{error ?? "Could not load earnings."}</div>;
  }

  const progress = data.currentMonth.total > 0 ? Math.min(100, Math.round((data.currentMonth.total / Math.max(data.stats.totalEarned, data.currentMonth.total)) * 100)) : 0;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {cards.map((card) => (
          <div key={card.label} style={panelStyle}>
            <p style={eyebrowStyle}>{card.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800 }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <p style={eyebrowStyle}>Current Month Breakdown</p>
            <p style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 700 }}>
              {formatMonth(data.currentMonth.month)} - {formatCurrency(data.currentMonth.total)} earned
            </p>
          </div>
          <span style={{ ...badgeStyle, ...statusTone(data.currentMonth.status) }}>{data.currentMonth.status.replace("_", " ")}</span>
        </div>
        <div style={{ marginTop: 12, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #38BDF8 0%, #22C55E 100%)",
            }}
          />
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div style={tableHeaderStyle}>
            <span>Type</span>
            <span>Client</span>
            <span>Plan</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {data.breakdown.length === 0 ? (
            <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>No earnings recorded this month yet.</p>
          ) : (
            data.breakdown.map((row) => (
              <div key={row.id} style={tableRowStyle}>
                <span>{row.type}</span>
                <span>{row.clientName}</span>
                <span>{row.plan}</span>
                <span>{formatCurrency(row.amount)}</span>
                <span style={{ ...badgeStyle, ...statusTone(row.status), width: "fit-content" }}>{row.status}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={eyebrowStyle}>Payment History</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.76)" }}>
              Best month: {formatMonth(data.stats.topMonth.month)} - {formatCurrency(data.stats.topMonth.amount)}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            Paid out: {formatCurrency(data.stats.totalPaid)}
          </p>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div style={tableHeaderStyle}>
            <span>Month</span>
            <span>Direct</span>
            <span>Recurring</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          {data.history.map((row) => (
            <div key={row.month} style={tableRowStyle}>
              <span>{formatMonth(row.month)}</span>
              <span>{formatCurrency(row.direct)}</span>
              <span>{formatCurrency(row.recurring + row.enterprise)}</span>
              <span>{formatCurrency(row.total)}</span>
              <span style={{ ...badgeStyle, ...statusTone(row.status), width: "fit-content" }}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, background: "linear-gradient(135deg, rgba(14,165,233,0.16), rgba(34,197,94,0.12))" }}>
        <p style={eyebrowStyle}>Momentum</p>
        <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700 }}>
          Build 30 active clients to unlock {formatCurrency(30_000)}/month just from renewals.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.78)" }}>
          You currently have {data.stats.activeClients} active recurring clients.
        </p>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.46)",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
};

const tableHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr 1fr 1fr 1fr",
  gap: 10,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "rgba(255,255,255,0.48)",
};

const tableRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr 1fr 1fr 1fr",
  gap: 10,
  alignItems: "center",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: "10px 12px",
  fontSize: 13,
};
