import { IceconnectMetroStage, LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { CUSTOMER_PLAN_LABEL, METRO_STAGE_LABEL } from "@/lib/iceconnect-sales-hub";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  try {
    const rows = await prisma.lead.findMany({
      where: {
        companyId: session.companyId,
        assignedTo: session.sub,
        iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
      },
      orderBy: { iceconnectSubscribedAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        phone: true,
        iceconnectCustomerPlan: true,
        iceconnectSubscribedAt: true,
        status: true,
      },
    });

    return NextResponse.json({
      ok: true as const,
      customers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        plan: r.iceconnectCustomerPlan
          ? CUSTOMER_PLAN_LABEL[r.iceconnectCustomerPlan]
          : "—",
        planKey: r.iceconnectCustomerPlan,
        startDate: r.iceconnectSubscribedAt?.toISOString() ?? null,
        status: r.status === LeadStatus.WON ? "Active" : String(r.status),
        stageLabel: METRO_STAGE_LABEL[IceconnectMetroStage.SUBSCRIPTION],
      })),
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/executive/customers", e);
  }
}
