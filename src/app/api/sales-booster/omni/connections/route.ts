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
import { SalesBoosterConnectionState, SalesBoosterOmnichannel } from "@prisma/client";

const patchSchema = z.object({
  channel: z.nativeEnum(SalesBoosterOmnichannel),
  status: z.nativeEnum(SalesBoosterConnectionState).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
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
    const rows = await prisma.salesBoosterChannelConnection.findMany({
      where: { companyId: user.companyId },
      orderBy: { channel: "asc" },
    });
    return jsonSuccess({
      connections: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        status: r.status,
        hasCredentials: r.credentials != null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/sales-booster/omni/connections", e);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;
  if (!user.companyId) {
    return NextResponse.json({ ok: false, error: "No company", code: "NO_COMPANY" }, { status: 400 });
  }

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await ensureSalesBoosterConnections(user.companyId);
    const row = await prisma.salesBoosterChannelConnection.update({
      where: {
        companyId_channel: {
          companyId: user.companyId,
          channel: parsed.data.channel,
        },
      },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.credentials !== undefined
          ? { credentials: parsed.data.credentials as object }
          : {}),
      },
    });
    return jsonSuccess({
      connection: {
        id: row.id,
        channel: row.channel,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError("PATCH /api/sales-booster/omni/connections", e);
  }
}
