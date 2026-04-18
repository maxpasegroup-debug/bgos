import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { requireLiveProPlan } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { ensureSalesBoosterConnections } from "@/lib/sales-booster-omni";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export async function GET(_request: NextRequest) {
  const user = await requireAuthWithRoles(_request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;
  if (!user.companyId) {
    return NextResponse.json({ ok: false, error: "No company", code: "NO_COMPANY" }, { status: 400 });
  }

  try {
    await ensureSalesBoosterConnections(user.companyId);

    const [connectedChannels, activeCampaigns, unreadMessages] = await Promise.all([
      prisma.salesBoosterChannelConnection.count({
        where: { companyId: user.companyId, status: "CONNECTED" },
      }),
      prisma.salesBoosterOmnichannelCampaign.count({
        where: {
          companyId: user.companyId,
          status: { in: ["SCHEDULED", "SENT"] },
        },
      }),
      prisma.salesBoosterOmnichannelMessage.count({
        where: { companyId: user.companyId, readAt: null },
      }),
    ]);

    return jsonSuccess({
      connectedChannels,
      activeCampaigns,
      unreadMessages,
    });
  } catch (e) {
    return handleApiError("GET /api/sales-booster/omni/summary", e);
  }
}
