import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesNetworkRole } from "@prisma/client";
import { z } from "zod";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { applyLeadPipelineUpdate } from "@/lib/lead-status-service";
import { getInternalMembership } from "@/lib/internal-platform/get-internal-membership";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { isSuperBossEmail } from "@/lib/super-boss";

const bodySchema = z.object({
  user_id: z.string().min(1),
});

function canAssign(snr: SalesNetworkRole | null, superBoss: boolean) {
  if (superBoss) return true;
  return (
    snr === SalesNetworkRole.RSM ||
    snr === SalesNetworkRole.BDM ||
    snr === SalesNetworkRole.BOSS
  );
}

/** Assign an internal-network lead to a BDE (or other member). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const m = await getInternalMembership(prisma, session.sub);
    if (!m.ok) {
      return NextResponse.json(
        { ok: false as const, error: m.error, code: m.code },
        { status: m.code === "INTERNAL_ORG" ? 500 : 403 },
      );
    }

    const superBoss = session.superBoss === true && isSuperBossEmail(session.email);
    if (!canAssign(m.userCompany.salesNetworkRole, superBoss)) {
      return NextResponse.json(
        { ok: false as const, error: "RSM, BDM, or platform lead only", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const { id: leadId } = await ctx.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "user_id required", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const result = await applyLeadPipelineUpdate({
      actorId: session.sub,
      companyId: org.companyId,
      leadId,
      assignedToUserId: parsed.data.user_id,
    });

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
    return NextResponse.json({ ok: true as const, lead: result.lead });
  } catch (e) {
    logCaughtError("PATCH /api/internal/leads/[id]/assign", e);
    return NextResponse.json(
      { ok: false as const, error: "Assign failed", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
