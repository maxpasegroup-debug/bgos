/**
 * /bgos-boss — BGOS Boss dashboard.
 *
 * Security: two layers (middleware + server check).
 * Data: `src/lib/bgosData.ts` (internal org + Iceconnect BGOS domain).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { AUTH_HEADER_USER_EMAIL } from "@/lib/auth-config";
import {
  formatInr,
  generateInsights,
  getActiveSubscriptions,
  getConversionSnapshot,
  getEmployeeStats,
  getFinanceRollup,
  getLowPerformers,
  getPerformanceSummary,
  getRecentActivities,
  getRevenueStats,
  getTechStats,
  getTopPerformers,
  getTotalEmployees,
  getBdeNexaFieldSnapshot,
  getBdeWalletBossSnapshot,
} from "@/lib/bgosData";
import { isSuperBossEmail } from "@/lib/super-boss";
import { BgosBossNetworkActions } from "./_components/BgosBossNetworkActions";
import { BgosBossRefresh } from "./_components/BgosBossRefresh";
import { CommandCenter } from "./_components/CommandCenter";
import { NexaCeoPanel } from "./_components/NexaCeoPanel";
import { TrainingControl } from "./_components/TrainingControl";

export const metadata: Metadata = {
  title: "BGOS Boss",
  robots: { index: false, follow: false },
};

const DOMAIN = "bgos" as const;

const ACTIVITY_ICON: Record<string, { dot: string; label: string }> = {
  sale: { dot: "#34D399", label: "SALE" },
  lead: { dot: "#A78BFA", label: "LEAD" },
  onboard: { dot: "#7C5CFF", label: "ONBOARD" },
};

export default async function BgosBossPage() {
  const hdrs = await headers();
  const email = hdrs.get(AUTH_HEADER_USER_EMAIL) ?? "";

  if (!isSuperBossEmail(email)) {
    redirect("/login?reason=unauthorized");
  }

  const [
    revenue,
    activeSubs,
    employees,
    perfSummary,
    activities,
    employeeStats,
    topPerformers,
    lowPerformers,
    tech,
    finance,
    conversion,
    nexaField,
    bdeWalletBoss,
  ] = await Promise.all([
    getRevenueStats(DOMAIN),
    getActiveSubscriptions(DOMAIN),
    getTotalEmployees(DOMAIN),
    getPerformanceSummary(DOMAIN),
    getRecentActivities(DOMAIN, 10),
    getEmployeeStats(DOMAIN),
    getTopPerformers(DOMAIN, 5),
    getLowPerformers(DOMAIN, 5),
    getTechStats(),
    getFinanceRollup(DOMAIN),
    getConversionSnapshot(DOMAIN),
    getBdeNexaFieldSnapshot(DOMAIN),
    getBdeWalletBossSnapshot(DOMAIN),
  ]);

  const insights = generateInsights({
    revenue,
    employeeStats,
    topPerformers,
    lowPerformers,
    conversion,
  });

  const revGrowth = revenue.revenue_30d_growth_pct;
  const growthLabel =
    revGrowth == null ? "—" : `${revGrowth >= 0 ? "+" : ""}${revGrowth.toFixed(1)}%`;
  const growthPositive = revGrowth == null ? true : revGrowth >= 0;

  const metrics = [
    {
      label: "Total Revenue",
      value: formatInr(revenue.total_revenue),
      delta: growthLabel,
      positive: growthPositive,
    },
    {
      label: "Active Subscriptions",
      value: String(activeSubs),
      delta: revenue.new_subscriptions_mtd > 0 ? `+${revenue.new_subscriptions_mtd} MTD` : "—",
      positive: revenue.new_subscriptions_mtd >= 0,
    },
    {
      label: "Total Employees",
      value: String(employees),
      delta: "ICECONNECT · BGOS",
      positive: true,
    },
    {
      label: "Conversion Rate",
      value: `${conversion.rate_pct.toFixed(1)}%`,
      delta: `${conversion.won_30d} won / ${conversion.pool_30d} new (30d)`,
      positive: conversion.rate_pct >= 15,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <BgosBossRefresh intervalMs={45000} />

      <NexaCeoPanel
        revenueLabel={formatInr(revenue.monthly_revenue)}
        growthLabel={growthLabel}
        growthPositive={growthPositive}
        periodLabel="This month (Iceconnect BGOS)"
        alerts={insights.alerts}
      />

      <section>
        <SectionLabel>Nexa field · BDE activity</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div style={glassCard}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>Prospects (all time)</p>
            <p style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{nexaField.total_prospects}</p>
          </div>
          <div style={glassCard}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>Added today</p>
            <p style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{nexaField.prospects_today}</p>
          </div>
          <div style={glassCard}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>Missions done today</p>
            <p style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{nexaField.missions_completed_today}</p>
          </div>
        </div>
        {nexaField.top_performers.length > 0 ? (
          <div style={{ ...glassCard, marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 12px" }}>Top BDEs (prospects)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {nexaField.top_performers.map((p) => (
                <div
                  key={p.user_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ color: "#34D399", fontWeight: 700 }}>{p.prospects}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <SectionLabel>BDE wallet &amp; payouts</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div style={glassCard}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>Total paid out</p>
            <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{formatInr(bdeWalletBoss.total_payouts_inr)}</p>
          </div>
          <div style={glassCard}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>Pending withdrawals</p>
            <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{formatInr(bdeWalletBoss.pending_withdrawals_inr)}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "8px 0 0" }}>
              {bdeWalletBoss.pending_request_count} request(s)
            </p>
          </div>
        </div>
        {bdeWalletBoss.top_earners.length > 0 ? (
          <div style={{ ...glassCard, marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 12px" }}>Top earners (lifetime)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bdeWalletBoss.top_earners.map((w) => (
                <div
                  key={w.user_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  <span>{w.name}</span>
                  <span style={{ color: "#4FD1FF", fontWeight: 700 }}>{formatInr(w.total_earned)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <SectionLabel>Key Metrics</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {metrics.map((m) => (
            <div key={m.label} style={glassCard}>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  fontWeight: 500,
                  margin: "0 0 10px",
                  letterSpacing: "0.02em",
                }}
              >
                {m.label}
              </p>
              <p
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-1px",
                  color: "rgba(255,255,255,0.95)",
                  margin: "0 0 6px",
                }}
              >
                {m.value}
              </p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: m.positive ? "#34D399" : "#EF4444",
                  background: m.positive ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: `1px solid ${m.positive ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}
              >
                {m.delta}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <section>
          <SectionLabel>Sales Network</SectionLabel>
          <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { role: "RSM", count: employeeStats.total_rsm, color: "#7C5CFF" },
                { role: "BDM", count: employeeStats.total_bdm, color: "#4FD1FF" },
                { role: "BDE", count: employeeStats.total_bde, color: "#34D399" },
                { role: "Tech", count: employeeStats.total_tech, color: "#F59E0B" },
              ].map((r) => (
                <div
                  key={r.role}
                  style={{
                    padding: "14px 12px",
                    borderRadius: 12,
                    background: `${r.color}0A`,
                    border: `1px solid ${r.color}20`,
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: r.color,
                      margin: "0 0 4px",
                      letterSpacing: "-1px",
                    }}
                  >
                    {r.count}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.35)",
                      margin: 0,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {r.role}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                Performance ({perfSummary.month_key} rollups): revenue ₹
                {Math.round(perfSummary.total_revenue_rollups).toLocaleString("en-IN")} · sales{" "}
                {perfSummary.total_sales_rollups.toFixed(0)} · new customers {perfSummary.new_customers}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: "0 0 6px" }}>Top</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                    {topPerformers.slice(0, 3).map((p) => (
                      <li key={p.userId}>
                        {p.name} · {p.points} pts · {p.active_subscriptions} subs
                      </li>
                    ))}
                    {topPerformers.length === 0 && <li style={{ listStyle: "none" }}>No data yet</li>}
                  </ul>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: "0 0 6px" }}>Needs attention</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                    {lowPerformers.slice(0, 3).map((p) => (
                      <li key={p.userId}>
                        {p.name} · {p.points} pts · {p.active_subscriptions} subs
                      </li>
                    ))}
                    {lowPerformers.length === 0 && <li style={{ listStyle: "none" }}>No data yet</li>}
                  </ul>
                </div>
              </div>
            </div>

            <BgosBossNetworkActions />
          </div>
        </section>

        <section>
          <SectionLabel>Command Center</SectionLabel>
          <div style={glassCard}>
            <CommandCenter />
          </div>
        </section>

        <section>
          <SectionLabel>Training Materials</SectionLabel>
          <div style={glassCard}>
            <TrainingControl />
          </div>
        </section>

        <section>
          <SectionLabel>Finance Overview</SectionLabel>
          <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              {
                label: "Total Payouts (MTD)",
                value: `₹${Math.round(finance.total_payouts_mtd).toLocaleString("en-IN")}`,
                color: "#EF4444",
              },
              {
                label: "Pending Payouts",
                value: `₹${Math.round(finance.pending_payouts).toLocaleString("en-IN")}`,
                color: "#F59E0B",
              },
              {
                label: "Revenue Retained",
                value:
                  finance.revenue_retained_pct == null
                    ? "—"
                    : `${finance.revenue_retained_pct.toFixed(1)}%`,
                color: "#34D399",
              },
            ].map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 16px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>{f.label}</p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: f.color,
                    margin: 0,
                    letterSpacing: "-0.5px",
                  }}
                >
                  {f.value}
                </p>
              </div>
            ))}
            {insights.suggestions.length > 0 && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "4px 0 0", lineHeight: 1.45 }}>
                {insights.suggestions[0]}
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionLabel>Tech Operations</SectionLabel>
          <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Pending Tasks", value: String(tech.pending_tasks), color: "#F59E0B" },
              { label: "Completed (all time)", value: String(tech.completed_tasks), color: "#34D399" },
              { label: "Avg Completion", value: tech.avg_time_label, color: "#4FD1FF" },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 16px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>{t.label}</p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: t.color,
                    margin: 0,
                    letterSpacing: "-0.5px",
                  }}
                >
                  {t.value}
                </p>
              </div>
            ))}
            <a
              href="/api/tech/requests"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...outlineBtn("#4FD1FF"), display: "inline-block", textDecoration: "none" }}
            >
              View Tech Tasks →
            </a>
          </div>
        </section>

        <section style={{ gridColumn: "1 / -1" }}>
          <SectionLabel>Activity Log — latest 10</SectionLabel>
          <div
            style={{
              ...glassCard,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              padding: 0,
              overflow: "hidden",
            }}
          >
            {activities.length === 0 ? (
              <p style={{ padding: "20px 22px", margin: 0, color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                No recent activity in the internal org.
              </p>
            ) : (
              activities.map((a, i) => {
                const s = ACTIVITY_ICON[a.type] ?? ACTIVITY_ICON.sale;
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "13px 20px",
                      borderBottom: i < activities.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: s.dot,
                        flexShrink: 0,
                      }}
                    />
                    <p
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: "rgba(255,255,255,0.65)",
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      {a.text}
                    </p>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: "rgba(255,255,255,0.2)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {a.time}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        color: s.dot,
                        background: `${s.dot}12`,
                        padding: "2px 7px",
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.22)",
        textTransform: "uppercase",
        margin: "0 0 10px",
      }}
    >
      {children}
    </p>
  );
}

const glassCard: CSSProperties = {
  padding: "20px 22px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
};

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
