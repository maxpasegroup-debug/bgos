import { OnboardingPipelineStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  if (session.employeeSystem !== "ICECONNECT") {
    return NextResponse.json({ ok: false as const, error: "ICECONNECT workforce only" }, { status: 403 });
  }

  const role = session.iceconnectEmployeeRole;
  if (!role) {
    return NextResponse.json({ ok: false as const, error: "Invalid workforce role" }, { status: 403 });
  }

  const where =
    role === "RSM"
      ? {}
      : role === "BDM"
        ? { assignedBdmId: session.sub }
        : role === "BDE"
          ? { assignedBdeId: session.sub }
          : role === "TECH_EXEC"
            ? { status: OnboardingPipelineStatus.SENT_TO_TECH }
            : null;
  if (where == null) {
    return NextResponse.json({ ok: false as const, error: "Forbidden role" }, { status: 403 });
  }

  try {
    const rows = await prisma.onboardingPipeline.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: {
        id: true,
        companyId: true,
        companyName: true,
        sourceType: true,
        sourceUserId: true,
        assignedRsmId: true,
        assignedBdmId: true,
        assignedBdeId: true,
        assignedRsm: { select: { id: true, name: true } },
        assignedBdm: { select: { id: true, name: true } },
        assignedBde: { select: { id: true, name: true } },
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const buckets = {
      new: 0,
      in_progress: 0,
      sent_to_tech: 0,
      completed: 0,
    };
    for (const row of rows) {
      if (row.status === OnboardingPipelineStatus.NEW || row.status === OnboardingPipelineStatus.ASSIGNED) buckets.new += 1;
      else if (row.status === OnboardingPipelineStatus.IN_PROGRESS) buckets.in_progress += 1;
      else if (row.status === OnboardingPipelineStatus.SENT_TO_TECH) buckets.sent_to_tech += 1;
      else if (row.status === OnboardingPipelineStatus.COMPLETED) buckets.completed += 1;
    }

    return NextResponse.json({
      ok: true as const,
      counts: buckets,
      data: rows.map((r) => ({
        owned_by:
          r.assignedBde
            ? { id: r.assignedBde.id, name: r.assignedBde.name, role: "BDE" }
            : r.assignedBdm
              ? { id: r.assignedBdm.id, name: r.assignedBdm.name, role: "BDM" }
              : r.assignedRsm
                ? { id: r.assignedRsm.id, name: r.assignedRsm.name, role: "RSM" }
                : null,
        id: r.id,
        company_id: r.companyId,
        company_name: r.companyName,
        source_type: r.sourceType.toLowerCase(),
        source_user_id: r.sourceUserId,
        assigned_rsm_id: r.assignedRsmId,
        assigned_bdm_id: r.assignedBdmId,
        assigned_bde_id: r.assignedBdeId,
        status: r.status.toLowerCase(),
        notes: r.notes,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/onboarding/pipeline", error);
    return NextResponse.json(
      { ok: false as const, message: "Could not load onboarding pipeline" },
      { status: 500 },
    );
  }
}
