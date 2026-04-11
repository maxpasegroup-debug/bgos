import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const rows = await prisma.internalInAppNotification.findMany({
    where: { companyId: ctx.companyId, userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = rows.filter((r) => r.readAt === null).length;

  return jsonSuccess({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    unreadCount: unread,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  await prisma.internalInAppNotification.updateMany({
    where: { companyId: ctx.companyId, userId: session.sub, readAt: null },
    data: { readAt: new Date() },
  });

  return jsonSuccess({ ok: true });
}
