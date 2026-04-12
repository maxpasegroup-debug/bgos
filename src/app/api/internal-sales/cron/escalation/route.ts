import type { NextRequest } from "next/server";
import { InternalSalesStage, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import {
  listInternalManagerUserIds,
  listInternalTechUserIds,
  notifyInternalUsers,
} from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { getBgosBossEmail } from "@/lib/super-boss";

const TWO_H_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

/**
 * Escalation: sales idle 2h → manager; tech idle 24h → manager + platform boss (if configured).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await getOrCreateInternalSalesCompanyId();
  if ("error" in resolved) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 500 });
  }
  const companyId = resolved.companyId;
  const now = Date.now();

  const salesStages: InternalSalesStage[] = [
    InternalSalesStage.LEAD_ADDED,
    InternalSalesStage.INTRO_CALL,
    InternalSalesStage.DEMO_ORIENTATION,
    InternalSalesStage.FOLLOW_UP,
    InternalSalesStage.INTERESTED,
  ];

  const salesLeads = await prisma.lead.findMany({
    where: {
      companyId,
      internalSalesStage: { in: salesStages },
      assignedTo: { not: null },
    },
    select: {
      id: true,
      name: true,
      assignedTo: true,
      internalStageUpdatedAt: true,
      updatedAt: true,
    },
  });

  const managers = await listInternalManagerUserIds(companyId);
  let salesEscalations = 0;

  for (const l of salesLeads) {
    const t = (l.internalStageUpdatedAt ?? l.updatedAt).getTime();
    if (now - t < TWO_H_MS) continue;
    if (!l.assignedTo) continue;
    const mem = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: l.assignedTo, companyId } },
      select: { jobRole: true },
    });
    if (!mem || mem.jobRole === UserRole.MANAGER || mem.jobRole === UserRole.ADMIN) continue;
    if (managers.length === 0) continue;
    await notifyInternalUsers({
      companyId,
      userIds: managers,
      type: "ESCALATION_SALES_DELAY",
      title: "Sales delay",
      body: `${l.name} — no stage movement in 2+ hours.`,
      dedupeKey: `esc-sales:${l.id}:${Math.floor(now / TWO_H_MS)}`,
    });
    salesEscalations += 1;
  }

  const techLeads = await prisma.lead.findMany({
    where: {
      companyId,
      internalSalesStage: InternalSalesStage.SENT_TO_TECH,
    },
    select: {
      id: true,
      name: true,
      internalStageUpdatedAt: true,
      updatedAt: true,
    },
  });

  const techIds = await listInternalTechUserIds(companyId);
  const bossEmail = getBgosBossEmail();
  const bossUser = bossEmail
    ? await prisma.user.findFirst({
        where: { email: { equals: bossEmail, mode: "insensitive" } },
        select: { id: true },
      })
    : null;

  let techEscalations = 0;
  for (const l of techLeads) {
    const t = (l.internalStageUpdatedAt ?? l.updatedAt).getTime();
    if (now - t < TWENTY_FOUR_H_MS) continue;
    const recipients = new Set(managers);
    if (bossUser) recipients.add(bossUser.id);
    if (recipients.size === 0 && techIds.length === 0) continue;
    await notifyInternalUsers({
      companyId,
      userIds: [...recipients],
      type: "ESCALATION_TECH_DELAY",
      title: "Tech delay",
      body: `${l.name} — tech pipeline idle 24+ hours.`,
      dedupeKey: `esc-tech:${l.id}:${Math.floor(now / TWENTY_FOUR_H_MS)}`,
    });
    techEscalations += 1;
  }

  return NextResponse.json({
    ok: true as const,
    salesEscalations,
    techEscalations,
  });
}
