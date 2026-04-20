import Link from "next/link";
import { redirect } from "next/navigation";
import { DealStatus, LeadStatus, TaskStatus } from "@prisma/client";
import { glassCard, sectionLabel } from "@/components/solar-boss/solarBossStyles";
import { getAuthUserFromCookies } from "@/lib/auth";
import { getCompanyUsage } from "@/lib/company-limits";
import { prisma } from "@/lib/prisma";
import { getSolarBossNexaInsights } from "@/lib/solar-boss-nexa";

export default async function SolarBossDashboardPage() {
  const user = await getAuthUserFromCookies();
  if (!user?.companyId) {
    redirect("/onboarding/nexa");
  }
  const companyId = user.companyId;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [usage, nexa, pendingInstalls, followUpTasks, paymentsToday, leadsOpen, siteVisits, dealsOpen] =
    await Promise.all([
      getCompanyUsage(companyId),
      getSolarBossNexaInsights(companyId),
      prisma.installation.count({ where: { companyId, completedAt: null } }).catch(() => 0),
      prisma.task.count({
        where: {
          companyId,
          status: TaskStatus.PENDING,
          dueDate: { lte: new Date(Date.now() + 864e5) },
        },
      }).catch(() => 0),
      prisma.invoicePayment
        .aggregate({
          where: { companyId, date: { gte: dayStart } },
          _sum: { amount: true },
        })
        .catch(() => ({ _sum: { amount: 0 as number | null } })),
      prisma.lead.count({
        where: {
          companyId,
          status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
        },
      }).catch(() => 0),
      prisma.siteVisit.count({ where: { companyId } }).catch(() => 0),
      prisma.deal.count({
        where: { companyId, status: { notIn: [DealStatus.WON, DealStatus.LOST] } },
      }).catch(() => 0),
    ]);

  const limitBlocks = [
    usage.userCount >= usage.limits.maxUsers,
    usage.leadCount >= usage.limits.maxLeads,
    usage.projectCount >= usage.limits.maxProjects,
  ].some(Boolean);

  const paySum = paymentsToday._sum.amount ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
          Control center
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
          Today · pipeline · Nexa · quick actions
        </p>
      </header>

      {limitBlocks ? (
        <div
          style={{
            ...glassCard,
            borderColor: "rgba(245,158,11,0.25)",
            background: "rgba(245,158,11,0.06)",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#FBBF24" }}>
            Upgrade plan to continue — a workspace limit is reached (users, leads, or projects).
          </p>
        </div>
      ) : null}

      <section>
        <p style={sectionLabel}>Today</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Pending installs", value: String(pendingInstalls), color: "#F59E0B" },
            { label: "Follow-ups", value: String(followUpTasks), color: "#4FD1FF" },
            { label: "Payments today", value: `₹${Math.round(paySum).toLocaleString("en-IN")}`, color: "#34D399" },
            { label: "Alerts", value: String(nexa.filter((n) => n.type === "alert").length), color: "#F87171" },
          ].map((c) => (
            <div key={c.label} style={glassCard}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>{c.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: c.color, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p style={sectionLabel}>Pipeline</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Leads", value: String(leadsOpen) },
            { label: "Site visits", value: String(siteVisits) },
            { label: "Deals open", value: String(dealsOpen) },
          ].map((c) => (
            <div key={c.label} style={glassCard}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 8px" }}>{c.label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p style={sectionLabel}>Nexa</p>
        <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: 10 }}>
          {nexa.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: n.type === "alert" ? "rgba(248,113,113,0.08)" : "rgba(79,209,255,0.06)",
                border: `1px solid ${n.type === "alert" ? "rgba(248,113,113,0.2)" : "rgba(79,209,255,0.15)"}`,
                fontSize: 14,
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.82)",
              }}
            >
              {n.text}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "10px 0 0", lineHeight: 1.4 }}>
          Automation: new lead → site visit task · deal won → install task · delays → alerts (wire to jobs when ready).
        </p>
      </section>

      <section>
        <p style={sectionLabel}>Quick actions</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            { href: "/solar-boss/sales", label: "Add lead" },
            { href: "/solar-boss/sales", label: "Follow-up" },
            { href: "/solar-boss/operations", label: "New project" },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                background: "rgba(79,209,255,0.12)",
                border: "1px solid rgba(79,209,255,0.22)",
                color: "#4FD1FF",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <p style={sectionLabel}>Usage vs limits</p>
        <div style={{ ...glassCard, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          Users {usage.userCount}/{usage.limits.maxUsers} · Leads {usage.leadCount}/{usage.limits.maxLeads} · Projects{" "}
          {usage.projectCount}/{usage.limits.maxProjects}
        </div>
      </section>
    </div>
  );
}
