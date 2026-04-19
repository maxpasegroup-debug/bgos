import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesHierarchyPlan } from "@prisma/client";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { recordHierarchySale } from "@/lib/sales-hierarchy/record-sale";
import { isSuperBossEmail } from "@/lib/super-boss";
import { handleApiError } from "@/lib/route-error";

const bodySchema = z.object({
  user_id: z.string().trim().min(1),
  plan_type: z.nativeEnum(SalesHierarchyPlan),
  company_id: z.string().trim().min(1).optional(),
  custom_points: z.number().int().min(3).max(5).optional(),
});

/**
 * Record a hierarchy subscription sale (points, earnings, promotion hooks).
 * Super boss may attribute to any member of the internal org; others only to self.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }

  const companyId = parsed.data.company_id?.trim() ?? org.companyId;
  if (companyId !== org.companyId && !isSuperBossEmail(session.email)) {
    return NextResponse.json(
      { ok: false as const, error: "Sales hierarchy runs on the internal org only.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const targetUserId = parsed.data.user_id.trim();
  if (!isSuperBossEmail(session.email) && targetUserId !== session.sub) {
    return NextResponse.json(
      { ok: false as const, error: "You can only record sales for your own user in V1.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const mem = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: targetUserId, companyId } },
    select: { id: true },
  });
  if (!mem) {
    return NextResponse.json(
      { ok: false as const, error: "User is not a member of this workspace.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  try {
    const result = await recordHierarchySale(prisma, {
      companyId,
      ownerUserId: targetUserId,
      planType: parsed.data.plan_type,
      customPoints: parsed.data.custom_points,
    });
    return NextResponse.json({
      ok: true as const,
      subscriptionId: result.subscriptionId,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "OWNER_NOT_IN_COMPANY") {
      return NextResponse.json(
        { ok: false as const, error: "Owner not in company", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    return handleApiError("POST /api/sales/create", e);
  }
}
