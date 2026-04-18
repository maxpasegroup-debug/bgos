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
import { SalesBoosterOmnichannel } from "@prisma/client";

const postSchema = z.object({
  channel: z.nativeEnum(SalesBoosterOmnichannel),
  sender: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(16000),
  leadId: z.string().trim().max(64).optional(),
});

const patchSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1).optional(),
  markAllRead: z.boolean().optional(),
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
    const channel = request.nextUrl.searchParams.get("channel") as SalesBoosterOmnichannel | null;
    const rows = await prisma.salesBoosterOmnichannelMessage.findMany({
      where: {
        companyId: user.companyId,
        ...(channel && Object.values(SalesBoosterOmnichannel).includes(channel) ? { channel } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return jsonSuccess({
      messages: rows.map((m) => ({
        id: m.id,
        channel: m.channel,
        sender: m.sender,
        content: m.content,
        leadId: m.leadId,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/sales-booster/omni/messages", e);
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
    const row = await prisma.salesBoosterOmnichannelMessage.create({
      data: {
        companyId: user.companyId,
        channel: parsed.data.channel,
        sender: parsed.data.sender,
        content: parsed.data.content,
        leadId: parsed.data.leadId || null,
      },
    });
    return jsonSuccess({
      message: {
        id: row.id,
        channel: row.channel,
        sender: row.sender,
        content: row.content,
        leadId: row.leadId,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError("POST /api/sales-booster/omni/messages", e);
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
  const { messageIds, markAllRead } = parsed.data;
  if (!markAllRead && (!messageIds || messageIds.length === 0)) {
    return NextResponse.json(
      { ok: false, error: "messageIds or markAllRead required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    if (markAllRead) {
      await prisma.salesBoosterOmnichannelMessage.updateMany({
        where: { companyId: user.companyId, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (messageIds?.length) {
      await prisma.salesBoosterOmnichannelMessage.updateMany({
        where: { companyId: user.companyId, id: { in: messageIds } },
        data: { readAt: new Date() },
      });
    }
    return jsonSuccess({ ok: true });
  } catch (e) {
    return handleApiError("PATCH /api/sales-booster/omni/messages", e);
  }
}
