import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { TechPipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, LOW: 2 } as const;

const STAGE_UI: Record<TechPipelineStage, "SETUP" | "CONFIG" | "TESTING" | "READY"> = {
  [TechPipelineStage.RECEIVED]: "SETUP",
  [TechPipelineStage.SETUP_DASHBOARD]: "SETUP",
  [TechPipelineStage.ADD_EMPLOYEES]: "SETUP",
  [TechPipelineStage.CONFIGURE_MODULES]: "CONFIG",
  [TechPipelineStage.TESTING]: "TESTING",
  [TechPipelineStage.READY]: "READY",
};

const DELAY_MS = 72 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const tasks = await prisma.onboardingTask.findMany({
    where: { company: { internalSalesOrg: false } },
    select: {
      id: true,
      snapshotCompanyName: true,
      pipelineStage: true,
      techQueuePriority: true,
      leadOnboardingType: true,
      updatedAt: true,
      company: { select: { id: true, name: true } },
    },
  });

  const now = Date.now();
  const items = tasks
    .map((t) => {
      const uiStage = STAGE_UI[t.pipelineStage];
      const onTrack =
        t.pipelineStage === TechPipelineStage.READY ||
        now - t.updatedAt.getTime() <= DELAY_MS;
      return {
        id: t.id,
        companyId: t.company.id,
        companyName: t.company.name || t.snapshotCompanyName,
        pipelineStage: t.pipelineStage,
        uiStage,
        priority: t.techQueuePriority,
        tier: t.leadOnboardingType,
        onTrack,
        updatedAt: t.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 99;
      const pb = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.companyName.localeCompare(b.companyName);
    });

  return NextResponse.json({ ok: true as const, items });
}
