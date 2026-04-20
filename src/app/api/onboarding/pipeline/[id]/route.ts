import { OnboardingPipelineStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { markCompanyOnboardingCompleted } from "@/lib/onboarding-pipeline";
import { prisma } from "@/lib/prisma";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    assigned_bdm_id: z.string().trim().optional(),
    assigned_bde_id: z.string().trim().optional(),
    notes: z.string().trim().max(8000).optional(),
  }),
  z.object({
    action: z.literal("start_onboarding"),
    employee_list: z.string().trim().max(8000),
    roles: z.string().trim().max(8000),
    departments: z.string().trim().max(8000),
    responsibilities: z.string().trim().max(8000),
  }),
  z.object({ action: z.literal("send_to_tech") }),
  z.object({
    action: z.literal("tech_update"),
    notes: z.string().trim().max(8000),
  }),
  z.object({
    action: z.literal("tech_complete"),
    notes: z.string().trim().max(8000).optional(),
  }),
]);

function appendNotes(prev: string | null, next?: string): string | undefined {
  const clean = next?.trim();
  if (!clean) return undefined;
  return `${prev ?? ""}\n${clean}`.trim();
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (session.employeeSystem !== "ICECONNECT") {
    return NextResponse.json({ ok: false as const, error: "ICECONNECT workforce only" }, { status: 403 });
  }

  const { id } = await context.params;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);
  const body = parsed.data;

  const role = session.iceconnectEmployeeRole;
  if (!role) {
    return NextResponse.json({ ok: false as const, error: "Invalid workforce role" }, { status: 403 });
  }

  const row = await prisma.onboardingPipeline.findUnique({
    where: { id },
    select: { id: true, companyId: true, assignedRsmId: true, assignedBdmId: true, assignedBdeId: true, status: true },
  });
  if (!row) {
    return NextResponse.json({ ok: false as const, error: "Onboarding pipeline not found" }, { status: 404 });
  }

  if (body.action === "assign") {
    if (role !== "RSM") {
      return NextResponse.json({ ok: false as const, error: "RSM only action" }, { status: 403 });
    }
    const mergedNotes = appendNotes(
      (await prisma.onboardingPipeline.findUnique({ where: { id }, select: { notes: true } }))?.notes ?? null,
      body.notes,
    );
    const status =
      body.assigned_bdm_id?.trim() || body.assigned_bde_id?.trim()
        ? OnboardingPipelineStatus.ASSIGNED
        : row.status;
    const updated = await prisma.onboardingPipeline.update({
      where: { id },
      data: {
        assignedRsmId: session.sub,
        assignedBdmId: body.assigned_bdm_id?.trim() || null,
        assignedBdeId: body.assigned_bde_id?.trim() || null,
        status,
        ...(mergedNotes ? { notes: mergedNotes } : {}),
      },
      select: { status: true },
    });
    return NextResponse.json({ ok: true as const, status: updated.status.toLowerCase() });
  }

  if (body.action === "start_onboarding") {
    if (role !== "BDE") {
      return NextResponse.json({ ok: false as const, error: "BDE only action" }, { status: 403 });
    }
    if (row.assignedBdeId && row.assignedBdeId !== session.sub) {
      return NextResponse.json({ ok: false as const, error: "This onboarding is assigned to another BDE" }, { status: 409 });
    }
    const payload = {
      employee_list: body.employee_list,
      roles: body.roles,
      departments: body.departments,
      responsibilities: body.responsibilities,
    };
    const updated = await prisma.onboardingPipeline.update({
      where: { id },
      data: {
        assignedBdeId: session.sub,
        status: OnboardingPipelineStatus.IN_PROGRESS,
        notes: JSON.stringify(payload),
      },
      select: { status: true },
    });
    return NextResponse.json({ ok: true as const, status: updated.status.toLowerCase() });
  }

  if (body.action === "send_to_tech") {
    if (role !== "BDE" && role !== "BDM" && role !== "RSM") {
      return NextResponse.json({ ok: false as const, error: "Sales chain only action" }, { status: 403 });
    }
    if (row.status !== OnboardingPipelineStatus.IN_PROGRESS && row.status !== OnboardingPipelineStatus.ASSIGNED) {
      return NextResponse.json({ ok: false as const, error: "Onboarding must be assigned or in progress before tech handoff" }, { status: 409 });
    }
    const updated = await prisma.onboardingPipeline.update({
      where: { id },
      data: { status: OnboardingPipelineStatus.SENT_TO_TECH },
      select: { status: true },
    });
    return NextResponse.json({ ok: true as const, status: updated.status.toLowerCase() });
  }

  if (role !== "TECH_EXEC") {
    return NextResponse.json({ ok: false as const, error: "Tech only action" }, { status: 403 });
  }

  if (body.action === "tech_update") {
    if (row.status !== OnboardingPipelineStatus.SENT_TO_TECH) {
      return NextResponse.json({ ok: false as const, error: "Onboarding is not in tech queue" }, { status: 409 });
    }
    const merged = appendNotes(
      (await prisma.onboardingPipeline.findUnique({ where: { id }, select: { notes: true } }))?.notes ?? null,
      body.notes,
    );
    await prisma.onboardingPipeline.update({
      where: { id },
      data: { ...(merged ? { notes: merged } : {}) },
    });
    return NextResponse.json({ ok: true as const, status: row.status.toLowerCase() });
  }

  const note = body.notes?.trim();
  if (row.status !== OnboardingPipelineStatus.SENT_TO_TECH) {
    return NextResponse.json({ ok: false as const, error: "Onboarding is not in tech queue" }, { status: 409 });
  }
  const mergedNotes = appendNotes(
    (await prisma.onboardingPipeline.findUnique({ where: { id }, select: { notes: true } }))?.notes ?? null,
    note,
  );
  await prisma.onboardingPipeline.update({
    where: { id },
    data: {
      status: OnboardingPipelineStatus.COMPLETED,
      ...(mergedNotes ? { notes: mergedNotes } : {}),
    },
  });
  if (row.companyId) {
    await markCompanyOnboardingCompleted(row.companyId);
  }
  return NextResponse.json({ ok: true as const, status: "completed" });
}
