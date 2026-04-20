import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OnboardingPipelineStatus, OnboardingRequestStatus } from "@prisma/client";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { markCompanyOnboardingCompleted } from "@/lib/onboarding-pipeline";
import {
  requireBde,
  requireSalesReviewer,
  requireTechExec,
} from "@/lib/onboarding-request-guards";
import { provisionCompany } from "@/lib/provisioning";
import { prisma } from "@/lib/prisma";

function fullSerialize(
  r: {
    id: string;
    companyName: string;
    bossEmail: string;
    dashboardType: string;
    template: string;
    status: string;
    notes: string | null;
    salesQuestionnaire: unknown;
    techTemplate: string | null;
    techNotes: string | null;
    bossUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; name: string; email: string };
  },
) {
  return {
    id: r.id,
    company_name: r.companyName,
    boss_email: r.bossEmail,
    dashboard_type: r.dashboardType.toLowerCase(),
    template: r.template.toLowerCase(),
    status: r.status.toLowerCase(),
    notes: r.notes,
    sales_questionnaire: r.salesQuestionnaire,
    tech_template: r.techTemplate,
    tech_notes: r.techNotes,
    boss_user_id: r.bossUserId,
    created_by: {
      id: r.createdBy.id,
      name: r.createdBy.name,
      email: r.createdBy.email,
    },
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  try {
    const row = await prisma.onboardingRequest.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!row) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }

    const bdeGate = requireBde(session);
    if (!(bdeGate instanceof NextResponse)) {
      if (row.createdByUserId !== session.sub) {
        return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ ok: true as const, request: fullSerialize(row) });
    }

    const salesGate = requireSalesReviewer(session);
    if (!(salesGate instanceof NextResponse)) {
      return NextResponse.json({ ok: true as const, request: fullSerialize(row) });
    }

    const techGate = requireTechExec(session);
    if (!(techGate instanceof NextResponse)) {
      return NextResponse.json({ ok: true as const, request: fullSerialize(row) });
    }

    return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });
  } catch (e) {
    return handleApiError("GET /api/onboarding-requests/[id]", e);
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sales_save"),
    team_structure: z.string().max(8000).optional(),
    roles: z.string().max(8000).optional(),
    departments: z.string().max(8000).optional(),
    expected_users: z.string().max(8000).optional(),
  }),
  z.object({
    action: z.literal("sales_approve"),
  }),
  z.object({
    action: z.literal("tech_update"),
    tech_template: z.string().max(200).optional(),
    tech_notes: z.string().max(8000).optional(),
  }),
  z.object({
    action: z.literal("tech_complete"),
  }),
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);
  const body = parsed.data;

  try {
    const existing = await prisma.onboardingRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }

    if (body.action === "sales_save" || body.action === "sales_approve") {
      const g = requireSalesReviewer(session);
      if (g instanceof NextResponse) return g;
      if (
        existing.status !== OnboardingRequestStatus.PENDING &&
        existing.status !== OnboardingRequestStatus.SALES_REVIEW
      ) {
        return NextResponse.json(
          { ok: false as const, error: "Not in sales review stage", code: "INVALID_STATUS" as const },
          { status: 409 },
        );
      }

      if (body.action === "sales_save") {
        const q = {
          team_structure: body.team_structure ?? "",
          roles: body.roles ?? "",
          departments: body.departments ?? "",
          expected_users: body.expected_users ?? "",
        };
        await prisma.onboardingRequest.update({
          where: { id },
          data: {
            salesQuestionnaire: q,
            status: OnboardingRequestStatus.SALES_REVIEW,
          },
        });
        return NextResponse.json({ ok: true as const, status: "sales_review" });
      }

      if (existing.status !== OnboardingRequestStatus.SALES_REVIEW) {
        return NextResponse.json(
          {
            ok: false as const,
            error: "Save the questionnaire first (status must be sales review)",
            code: "INVALID_STATUS" as const,
          },
          { status: 409 },
        );
      }

      await prisma.onboardingRequest.update({
        where: { id },
        data: { status: OnboardingRequestStatus.TECH_QUEUE },
      });
      await prisma.onboardingPipeline.updateMany({
        where: { notes: { contains: id } },
        data: { status: OnboardingPipelineStatus.SENT_TO_TECH },
      });
      return NextResponse.json({ ok: true as const, status: "tech_queue" });
    }

    if (body.action === "tech_update" || body.action === "tech_complete") {
      const g = requireTechExec(session);
      if (g instanceof NextResponse) return g;
      if (existing.status !== OnboardingRequestStatus.TECH_QUEUE) {
        return NextResponse.json(
          { ok: false as const, error: "Not in tech queue", code: "INVALID_STATUS" as const },
          { status: 409 },
        );
      }

      if (body.action === "tech_update") {
        await prisma.onboardingRequest.update({
          where: { id },
          data: {
            techTemplate: body.tech_template ?? existing.techTemplate,
            techNotes: body.tech_notes ?? existing.techNotes,
          },
        });
        return NextResponse.json({ ok: true as const, status: "tech_queue" });
      }

      const templateLabel = existing.techTemplate ?? String(existing.dashboardType);

      const provision = await provisionCompany(id);

      if (!provision.ok) {
        return NextResponse.json(
          { ok: false as const, error: provision.error, code: provision.code ?? "PROVISION_FAILED" },
          { status: 409 },
        );
      }

      await prisma.onboardingRequest.update({
        where: { id },
        data: {
          status: OnboardingRequestStatus.COMPLETED,
          bossUserId: provision.userId,
          techTemplate: templateLabel,
        },
      });
      await prisma.onboardingPipeline.updateMany({
        where: { notes: { contains: id } },
        data: {
          companyId: provision.companyId,
          status: OnboardingPipelineStatus.COMPLETED,
        },
      });
      await markCompanyOnboardingCompleted(provision.companyId);

      return NextResponse.json({
        ok: true as const,
        status: "completed",
        boss_user_id: provision.userId,
        company_id: provision.companyId,
        message: provision.message,
      });
    }

    return NextResponse.json({ ok: false as const, error: "Unsupported" }, { status: 400 });
  } catch (e) {
    return handleApiError("PATCH /api/onboarding-requests/[id]", e);
  }
}
