import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { requireLiveProPlan } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { ensureSalesBoosterConnections } from "@/lib/sales-booster-omni";
import { USER_ADMIN_ROLES } from "@/lib/user-company";
import { SalesBoosterCampaignState, SalesBoosterOmnichannel } from "@prisma/client";

const postSchema = z.object({
  name: z.string().trim().min(1).max(200),
  channel: z.nativeEnum(SalesBoosterOmnichannel),
});

export async function GET(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;
  if (!user.companyId) {
    return NextResponse.json({ ok: false, error: "No company", code: "NO_COMPANY" }, { status: 400 });
  }

  try {
    await ensureSalesBoosterConnections(user.companyId);
    const rows = await prisma.salesBoosterOmnichannelCampaign.findMany({
      where: { companyId: user.companyId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return jsonSuccess({
      campaigns: rows.map((r) => ({
        id: r.id,
        name: r.name,
        channel: r.channel,
        status: r.status,
        sentCount: r.sentCount,
        deliveredCount: r.deliveredCount,
        responseCount: r.responseCount,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/sales-booster/omni/campaigns", e);
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;
  if (!user.companyId) {
    return NextResponse.json({ ok: false, error: "No company", code: "NO_COMPANY" }, { status: 400 });
  }

  const parsed = await parseJsonBodyZod(request, postSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await ensureSalesBoosterConnections(user.companyId);
    const row = await prisma.salesBoosterOmnichannelCampaign.create({
      data: {
        companyId: user.companyId,
        name: parsed.data.name,
        channel: parsed.data.channel,
        status: SalesBoosterCampaignState.DRAFT,
      },
    });
    return jsonSuccess({
      campaign: {
        id: row.id,
        name: row.name,
        channel: row.channel,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError("POST /api/sales-booster/omni/campaigns", e);
  }
}
