import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { addProspectForBde } from "@/lib/bde-nexa-engine";

const bodySchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(40),
  location: z.string().trim().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const { prospect, mission } = await addProspectForBde({
      userId: session.sub,
      companyName: parsed.data.company_name,
      phone: parsed.data.phone,
      location: parsed.data.location,
    });

    return NextResponse.json({
      ok: true as const,
      prospect: {
        id: prospect.id,
        company_name: prospect.companyName,
        phone: prospect.phone,
        location: prospect.location,
        pipeline_stage: prospect.pipelineStage.toLowerCase(),
      },
      mission: {
        completed_count: mission.completedCount,
        target_count: mission.targetCount,
        status: mission.status.toLowerCase(),
      },
    });
  } catch (e) {
    return handleApiError("POST /api/iceconnect/bde/prospect", e);
  }
}
