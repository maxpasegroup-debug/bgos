import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesNetworkRole, TechPipelineStage } from "@prisma/client";
import { z } from "zod";
import { deleteApiCacheByPrefix } from "@/lib/api-runtime-cache";
import { logCaughtError } from "@/lib/api-response";
import { getInternalMembership } from "@/lib/internal-platform/get-internal-membership";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { isSuperBossEmail } from "@/lib/super-boss";
import { nextPipelineStage, pipelineStageLabel } from "@/lib/tech-pipeline-sync";

const bodySchema = z.object({
  action: z.enum(["advance", "complete"]),
});

function canOperateTech(snr: SalesNetworkRole | null, superBoss: boolean) {
  if (superBoss) return true;
  if (snr === SalesNetworkRole.TECH_EXEC || snr === SalesNetworkRole.BOSS) return true;
  return false;
}

/**
 * Advance client onboarding pipeline stages (platform tech queue).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const m = await getInternalMembership(prisma, session.sub);
    if (!m.ok) {
      return NextResponse.json(
        { ok: false as const, error: m.error, code: m.code },
        { status: m.code === "INTERNAL_ORG" ? 500 : 403 },
      );
    }

    const superBoss = session.superBoss === true && isSuperBossEmail(session.email);
    if (!canOperateTech(m.userCompany.salesNetworkRole, superBoss)) {
      return NextResponse.json(
        { ok: false as const, error: "Tech or platform access only", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const { taskId } = await ctx.params;
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" as const },
        { status: 400 },
      );
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Invalid body", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const task = await prisma.onboardingTask.findFirst({
      where: { id: taskId },
      select: {
        id: true,
        companyId: true,
        pipelineStage: true,
      },
    });
    if (!task) {
      return NextResponse.json(
        { ok: false as const, error: "Task not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }

    let nextStage: TechPipelineStage;
    if (parsed.data.action === "complete") {
      nextStage = TechPipelineStage.READY;
    } else {
      const n = nextPipelineStage(task.pipelineStage);
      if (!n) {
        return NextResponse.json(
          { ok: false as const, error: "Already complete", code: "NO_NEXT" as const },
          { status: 400 },
        );
      }
      nextStage = n;
    }

    const updated = await prisma.onboardingTask.update({
      where: { id: taskId },
      data: { pipelineStage: nextStage },
      select: {
        id: true,
        pipelineStage: true,
        company: { select: { name: true } },
        techQueuePriority: true,
        leadOnboardingType: true,
      },
    });

    deleteApiCacheByPrefix("control:tech-queue");

    return NextResponse.json({
      ok: true as const,
      task: {
        id: updated.id,
        pipeline_stage: updated.pipelineStage,
        pipeline_label: pipelineStageLabel(updated.pipelineStage),
        company_name: updated.company.name,
        priority: updated.techQueuePriority,
        onboarding_type: updated.leadOnboardingType,
      },
    });
  } catch (e) {
    logCaughtError("POST /api/internal/onboarding-tasks/[taskId]/pipeline", e);
    return NextResponse.json(
      { ok: false as const, error: "Update failed", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
