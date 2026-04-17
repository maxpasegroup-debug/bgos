import "server-only";
import { prisma } from "@/lib/prisma";
import type { NexaOnboardingSource } from "@/lib/nexa-onboarding-engine";

export type NexaOnboardingStartExtras = {
  leadId?: string | null;
  partnerId?: string | null;
  salesOwnerId?: string | null;
  franchisePartnerId?: string | null;
  referralSource?: string | null;
};

function mergeSessionData(
  prev: unknown,
  extras: NexaOnboardingStartExtras,
  source: NexaOnboardingSource,
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : {};
  return {
    ...base,
    source,
    ...(extras.leadId ? { leadId: extras.leadId } : {}),
    ...(extras.partnerId ? { partnerId: extras.partnerId } : {}),
    ...(extras.salesOwnerId ? { salesOwnerId: extras.salesOwnerId } : {}),
    ...(extras.franchisePartnerId ? { franchisePartnerId: extras.franchisePartnerId } : {}),
    ...(extras.referralSource ? { referralSource: extras.referralSource } : {}),
  };
}

export async function startNexaOnboarding(input: {
  userId: string;
  source: NexaOnboardingSource;
  leadId?: string | null;
  partnerId?: string | null;
} & NexaOnboardingStartExtras) {
  const extras: NexaOnboardingStartExtras = {
    leadId: input.leadId ?? null,
    partnerId: input.partnerId ?? null,
    salesOwnerId: input.salesOwnerId ?? null,
    franchisePartnerId: input.franchisePartnerId ?? null,
    referralSource: input.referralSource ?? null,
  };

  const existing = await prisma.onboardingSession.findFirst({
    where: {
      createdByUserId: input.userId,
      source: input.source,
      status: { in: ["draft", "in_progress", "ready"] },
      ...(input.leadId ? { leadId: input.leadId } : {}),
    } as any,
    orderBy: { createdAt: "desc" },
    select: { id: true, data: true, leadId: true, partnerId: true },
  });

  if (existing) {
    const merged = mergeSessionData(existing.data, extras, input.source);
    const nextLead = input.leadId ?? existing.leadId ?? null;
    const nextPartner = input.partnerId ?? input.franchisePartnerId ?? existing.partnerId ?? null;
    await prisma.onboardingSession.update({
      where: { id: existing.id },
      data: {
        leadId: nextLead,
        partnerId: nextPartner,
        data: merged as object,
      },
    });
    return { sessionId: existing.id, resumed: true as const };
  }

  const created = await prisma.onboardingSession.create({
    data: {
      createdByUserId: input.userId,
      source: input.source,
      leadId: input.leadId ?? null,
      partnerId: input.partnerId ?? input.franchisePartnerId ?? null,
      status: "in_progress",
      currentStep: input.source === "SALES" ? "select_lead" : "industry",
      rawTeamInput: null,
      parsedTeam: {} as object,
      unknownRoles: [] as object,
      data: mergeSessionData(null, extras, input.source) as object,
    } as any,
    select: { id: true },
  });
  return { sessionId: created.id, resumed: false as const };
}
