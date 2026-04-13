import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canManageInternalSalesAssignments } from "@/lib/internal-sales-org";
import { WORKFLOW_CUSTOM_CATEGORY } from "@/lib/onboarding-workflow-templates";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const isManager = canManageInternalSalesAssignments(session);
  const isTech = session.role === "TECH_HEAD" || session.role === "TECH_EXECUTIVE";
  if (!isManager && !isTech) {
    return jsonError(403, "FORBIDDEN", "Tech or manager only");
  }

  try {
    const internalCo = await prisma.company.findFirst({
      where: { id: session.companyId, internalSalesOrg: true },
      select: { id: true },
    });

    const where = internalCo
      ? isManager
        ? {
            OR: [
              { companyId: session.companyId, status: { not: "DRAFT" as const } },
              { category: WORKFLOW_CUSTOM_CATEGORY, status: { not: "DRAFT" as const } },
            ],
          }
        : {
            OR: [
              {
                companyId: session.companyId,
                assignedTechUserId: session.sub,
                status: { not: "DRAFT" as const },
              },
              {
                category: WORKFLOW_CUSTOM_CATEGORY,
                assignedTechUserId: session.sub,
                status: { not: "DRAFT" as const },
              },
            ],
          }
      : isManager
        ? { companyId: session.companyId, status: { not: "DRAFT" as const } }
        : {
            companyId: session.companyId,
            assignedTechUserId: session.sub,
            status: { not: "DRAFT" as const },
          };

    const rows = await prisma.onboardingSubmission.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        status: true,
        planTier: true,
        category: true,
        completionPercent: true,
        assignedTechUserId: true,
        deliveryPdfPath: true,
        salesDeliveredAt: true,
        updatedAt: true,
        lead: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true as const, submissions: rows });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET workflow/tech", e);
  }
}
