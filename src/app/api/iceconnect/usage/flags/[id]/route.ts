import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UsageFlagStatus } from "@prisma/client";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireSalesChain } from "@/lib/onboarding-request-guards";
import {
  getCompanyIdsForBde,
  getCompanyIdsForBdm,
  getCompanyIdsForRsm,
} from "@/lib/sales-hierarchy";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  action_status: z.enum(["pending", "contacted", "closed"]).optional(),
  status: z
    .enum(["active", "in_progress", "converted", "closed"])
    .optional(),
});

function toPrismaStatus(s: string | undefined): UsageFlagStatus | undefined {
  if (!s) return undefined;
  const map: Record<string, UsageFlagStatus> = {
    active: UsageFlagStatus.ACTIVE,
    in_progress: UsageFlagStatus.IN_PROGRESS,
    converted: UsageFlagStatus.CONVERTED,
    closed: UsageFlagStatus.CLOSED,
  };
  return map[s];
}

async function canAccessFlag(userId: string, role: string | undefined, companyId: string) {
  if (role === "BDE") {
    const ids = await getCompanyIdsForBde(userId);
    return ids.includes(companyId);
  }
  if (role === "BDM") {
    const ids = await getCompanyIdsForBdm(userId);
    return ids.includes(companyId);
  }
  if (role === "RSM") {
    const ids = await getCompanyIdsForRsm(userId);
    return ids.includes(companyId);
  }
  return false;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireSalesChain(session);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const flag = await prisma.usageFlag.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!flag) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }

    const ok = await canAccessFlag(
      session.sub,
      session.iceconnectEmployeeRole ?? undefined,
      flag.companyId,
    );
    if (!ok) {
      return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });
    }

    const ps = toPrismaStatus(parsed.data.status);
    const updated = await prisma.usageFlag.update({
      where: { id },
      data: {
        ...(parsed.data.action_status != null
          ? { actionStatus: parsed.data.action_status }
          : {}),
        ...(ps != null ? { status: ps } : {}),
        handledById: session.sub,
      },
    });

    return NextResponse.json({
      ok: true as const,
      flag: {
        id: updated.id,
        action_status: updated.actionStatus,
        status: updated.status.toLowerCase(),
      },
    });
  } catch (e) {
    return handleApiError("PATCH /api/iceconnect/usage/flags/[id]", e);
  }
}
