import { CompanyBusinessType } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
} from "@/lib/internal-sales-org";

const bodySchema = z.object({
  customerCompanyId: z.string().trim().min(1),
});

/**
 * After sales closes the deal and final payment is confirmed, allow tech to proceed to
 * client-facing delivery steps for that customer's custom build.
 */
export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const internal = await assertInternalSalesSession(session);
  if (internal instanceof NextResponse) return internal;

  if (!canManageInternalSalesAssignments(session)) {
    return jsonError(403, "FORBIDDEN", "Only sales managers can unlock client contact.");
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const cust = await prisma.company.findFirst({
      where: {
        id: parsed.data.customerCompanyId,
        internalSalesOrg: false,
      },
      select: { id: true, businessType: true },
    });
    if (!cust) {
      return jsonError(404, "NOT_FOUND", "Customer company not found.");
    }
    if (cust.businessType !== CompanyBusinessType.CUSTOM) {
      return jsonError(400, "NOT_CUSTOM", "Unlock applies only to custom-build workspaces.");
    }

    await prisma.company.update({
      where: { id: cust.id },
      data: {
        customBuildClientContactAllowed: true,
        customFinalPaymentConfirmedAt: new Date(),
      },
    });

    return jsonSuccess({ ok: true as const, companyId: cust.id });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST unlock-client-contact", e);
  }
}
