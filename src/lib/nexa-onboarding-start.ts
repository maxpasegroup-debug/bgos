import "server-only";
import { prisma } from "@/lib/prisma";
import type { NexaOnboardingSource } from "@/lib/nexa-onboarding-engine";

export async function startNexaOnboarding(input: {
  userId: string;
  source: NexaOnboardingSource;
  leadId?: string | null;
  partnerId?: string | null;
}) {
  const existing = await prisma.onboardingSession.findFirst({
    where: {
      createdByUserId: input.userId,
      source: input.source,
      status: { in: ["draft", "in_progress", "ready"] },
      ...(input.leadId ? { leadId: input.leadId } : {}),
    } as any,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return { sessionId: existing.id, resumed: true as const };

  const created = await prisma.onboardingSession.create({
    data: {
      createdByUserId: input.userId,
      source: input.source,
      leadId: input.leadId ?? null,
      partnerId: input.partnerId ?? null,
      status: "in_progress",
      currentStep: input.source === "SALES" ? "select_lead" : "industry",
      rawTeamInput: null,
      parsedTeam: {} as object,
      unknownRoles: [] as object,
      data: {
        source: input.source,
        leadId: input.leadId ?? null,
        partnerId: input.partnerId ?? null,
      } as object,
    } as any,
    select: { id: true },
  });
  return { sessionId: created.id, resumed: false as const };
}
