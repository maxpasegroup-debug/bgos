import { DealStatus, IceconnectMetroStage, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, [UserRole.MANAGER]);
  if (session instanceof NextResponse) return session;

  try {
    const [memberships, franchises, leads, deals] = await Promise.all([
      prisma.userCompany.findMany({
        where: { companyId: session.companyId, jobRole: UserRole.SALES_EXECUTIVE },
        select: { userId: true, user: { select: { name: true, email: true } } },
      }),
      prisma.channelPartner.findMany({
        where: { companyId: session.companyId },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.lead.findMany({
        where: { companyId: session.companyId },
        select: { id: true, name: true, assignedTo: true, iceconnectMetroStage: true, status: true },
      }),
      prisma.deal.findMany({
        where: { companyId: session.companyId, status: DealStatus.WON },
        select: { value: true, lead: { select: { assignedTo: true } } },
      }),
    ]);

    const memberIds = memberships.map((m) => m.userId);
    const leadByExec = new Map<string, number>();
    const wonByExec = new Map<string, number>();
    const revenueByExec = new Map<string, number>();
    const unattendedHot: Array<{ id: string; name: string }> = [];

    for (const l of leads) {
      if (l.assignedTo && memberIds.includes(l.assignedTo)) {
        leadByExec.set(l.assignedTo, (leadByExec.get(l.assignedTo) ?? 0) + 1);
      }
      if (
        (l.iceconnectMetroStage === IceconnectMetroStage.DEMO_DONE ||
          l.iceconnectMetroStage === IceconnectMetroStage.FOLLOW_UP) &&
        !l.assignedTo
      ) {
        unattendedHot.push({ id: l.id, name: l.name });
      }
    }

    for (const d of deals) {
      const uid = d.lead.assignedTo;
      if (!uid) continue;
      wonByExec.set(uid, (wonByExec.get(uid) ?? 0) + 1);
      revenueByExec.set(uid, (revenueByExec.get(uid) ?? 0) + (d.value ?? 0));
    }

    const team = memberships.map((m) => {
      const leadsAssigned = leadByExec.get(m.userId) ?? 0;
      const wins = wonByExec.get(m.userId) ?? 0;
      const conversionPct = leadsAssigned > 0 ? Math.round((wins / leadsAssigned) * 100) : 0;
      const revenueGenerated = revenueByExec.get(m.userId) ?? 0;
      const target = Math.max(10, Math.ceil(leadsAssigned * 0.7));
      return {
        id: m.userId,
        name: m.user.name,
        email: m.user.email,
        leadsAssigned,
        conversionPct,
        revenueGenerated,
        target,
        achieved: wins,
      };
    });

    const stageRows = [
      { key: "NEW", label: "New", color: "bg-slate-500" },
      { key: "INTRODUCED", label: "Introduced", color: "bg-blue-500" },
      { key: "DEMO", label: "Demo", color: "bg-indigo-500" },
      { key: "FOLLOW_UP", label: "Follow-up", color: "bg-amber-500" },
      { key: "ONBOARD", label: "Onboard", color: "bg-violet-500" },
      { key: "SUBSCRIPTION", label: "Subscription", color: "bg-emerald-500" },
    ] as const;

    const pipeline = stageRows.map((s) => ({
      ...s,
      count: leads.filter((l) => String(l.iceconnectMetroStage ?? "").toUpperCase() === s.key).length,
    }));

    const totalRevenue = team.reduce((a, t) => a + t.revenueGenerated, 0);
    const activeLeads = leads.length;
    const avgConversion =
      team.length > 0 ? Math.round(team.reduce((a, t) => a + t.conversionPct, 0) / team.length) : 0;
    const underperformers = team.filter((t) => t.conversionPct < 20).map((t) => t.name);

    return NextResponse.json({
      success: true as const,
      data: {
        summary: {
          managerName: session.email,
          totalRevenue,
          activeLeads,
          teamPerformancePct: avgConversion,
        },
        team,
        franchises: franchises.map((f) => ({
          id: f.id,
          name: f.name,
          region: "Assigned region",
          leadsHandled: 0,
          revenueContribution: 0,
        })),
        pipeline,
        analytics: {
          dailySales: team.map((t) => ({ label: t.name, value: t.achieved })),
          weeklyPerformance: team.map((t) => ({ label: t.name, value: t.conversionPct })),
          topPerformers: [...team].sort((a, b) => b.revenueGenerated - a.revenueGenerated).slice(0, 5),
        },
        alerts: {
          underperformers,
          unattendedHotLeads: unattendedHot.slice(0, 8),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/manager/dashboard", error);
    return NextResponse.json(
      { success: false as const, message: "Failed to load manager dashboard" },
      { status: 500 },
    );
  }
}
