import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  OnboardingPipelineSourceType,
  OnboardingPipelineStatus,
  OnboardingRequestDashboardType,
  OnboardingRequestStatus,
} from "@prisma/client";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(200),
  boss_email: z.string().trim().email("Valid boss email is required").max(254),
  dashboard_type: z.enum(["solar", "builder", "academy", "custom"]),
  notes: z.string().trim().max(8000).optional(),
});

const MAP_TYPE: Record<string, OnboardingRequestDashboardType> = {
  solar: OnboardingRequestDashboardType.SOLAR,
  builder: OnboardingRequestDashboardType.BUILDER,
  academy: OnboardingRequestDashboardType.ACADEMY,
  custom: OnboardingRequestDashboardType.CUSTOM,
};

/**
 * BDE creates an onboarding request (ICECONNECT). `status` starts as {@link OnboardingRequestStatus.PENDING}.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { company_name, boss_email, notes } = parsed.data;
  const dashboardType = MAP_TYPE[parsed.data.dashboard_type];

  try {
    const row = await prisma.onboardingRequest.create({
      data: {
        createdByUserId: session.sub,
        companyName: company_name,
        bossEmail: boss_email.trim().toLowerCase(),
        dashboardType,
        template: dashboardType,
        status: OnboardingRequestStatus.PENDING,
        notes: notes?.length ? notes : null,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    await prisma.onboardingPipeline.create({
      data: {
        companyName: company_name,
        sourceType: OnboardingPipelineSourceType.BDE,
        sourceUserId: session.sub,
        assignedBdeId: session.sub,
        status: OnboardingPipelineStatus.NEW,
        notes: `Onboarding request linked: ${row.id}`,
      },
    });

    return NextResponse.json({
      ok: true as const,
      id: row.id,
      status: row.status,
      created_at: row.createdAt.toISOString(),
    });
  } catch (e) {
    return handleApiError("POST /api/onboarding/create", e);
  }
}
