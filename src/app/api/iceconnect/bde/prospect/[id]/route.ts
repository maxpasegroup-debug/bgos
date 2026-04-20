import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BdeProspectPipelineStage } from "@prisma/client";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { creditEarningOnProspectConversion } from "@/lib/bde-wallet";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  pipeline_stage: z.enum(["new", "contacted", "trial_started", "converted"]),
});

const MAP: Record<string, BdeProspectPipelineStage> = {
  new: BdeProspectPipelineStage.NEW,
  contacted: BdeProspectPipelineStage.CONTACTED,
  trial_started: BdeProspectPipelineStage.TRIAL_STARTED,
  converted: BdeProspectPipelineStage.CONVERTED,
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = patchSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const p = await prisma.bdeProspect.findFirst({
      where: { id, userId: session.sub },
    });
    if (!p) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }

    const nextStage = MAP[parsed.data.pipeline_stage];
    const becameConverted =
      nextStage === BdeProspectPipelineStage.CONVERTED &&
      p.pipelineStage !== BdeProspectPipelineStage.CONVERTED;

    const updated = await prisma.bdeProspect.update({
      where: { id },
      data: { pipelineStage: nextStage },
    });

    let earning_inr: number | null = null;
    if (becameConverted) {
      const r = await creditEarningOnProspectConversion(session.sub, id);
      if (r.credited) earning_inr = r.amount;
    }

    return NextResponse.json({
      ok: true as const,
      prospect: {
        id: updated.id,
        pipeline_stage: updated.pipelineStage.toLowerCase(),
      },
      ...(earning_inr != null ? { earning_inr } : {}),
    });
  } catch (e) {
    return handleApiError("PATCH /api/iceconnect/bde/prospect/[id]", e);
  }
}
