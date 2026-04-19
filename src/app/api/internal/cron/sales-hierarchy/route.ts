import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { runSalesHierarchyPromotions } from "@/lib/sales-hierarchy/promotion-v1";

/**
 * Daily job: evaluate BDE→BDM and BDM→RSM promotions (Nexa / cron).
 * POST with header `x-cron-secret: ${CRON_SECRET}`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false as const, error: "CRON_SECRET not set" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false as const, error: "Unauthorized" }, { status: 401 });
  }

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json({ ok: false as const, error: org.error }, { status: 503 });
  }

  const result = await runSalesHierarchyPromotions(prisma, org.companyId);
  return NextResponse.json({ ok: true as const, ...result });
}
