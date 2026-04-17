import { OnboardingStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PipelineStage = "pending" | "in_progress" | "completed";

function stageFor(row: {
  status: OnboardingStatus;
  companyId: string | null;
}): PipelineStage {
  if (row.status === OnboardingStatus.COMPLETED && row.companyId) return "completed";
  if (row.companyId) return "completed";
  if (row.status === OnboardingStatus.IN_PROGRESS) return "in_progress";
  return "pending";
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, [UserRole.MANAGER]);
  if (session instanceof NextResponse) return session;

  try {
    const rows = await prisma.onboarding.findMany({
      where: { lead: { companyId: session.companyId } },
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
        lead: {
          select: {
            id: true,
            name: true,
            assignedTo: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
        company: { select: { id: true, name: true, sourceType: true, sourceId: true } },
      },
    });

    return NextResponse.json({
      success: true as const,
      data: rows.map((r) => ({
        id: r.id,
        companyName: r.company?.name ?? r.lead.name,
        status: r.status,
        stage: stageFor(r),
        salesOwner: r.lead.assignee
          ? { id: r.lead.assignee.id, name: r.lead.assignee.name, email: r.lead.assignee.email }
          : null,
        leadId: r.lead.id,
        customerCompanyId: r.companyId,
      })),
    });
  } catch (error) {
    console.error("GET /api/onboarding/pipeline", error);
    return NextResponse.json(
      { success: false as const, message: "Could not load onboarding pipeline" },
      { status: 500 },
    );
  }
}
