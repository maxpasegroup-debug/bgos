import "server-only";

import { OnboardingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function asDataRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  return {};
}

/**
 * After a boss workspace is minted, link internal-sales `Onboarding` + stamp company attribution
 * from the active `OnboardingSession` (cookie `bgos_onboarding_sid`).
 */
export async function applyBossCompanyAttributionFromSession(options: {
  onboardingSessionId: string | null | undefined;
  newCompanyId: string;
  bossUserId: string;
}): Promise<void> {
  const sid = options.onboardingSessionId?.trim();
  if (!sid) return;

  const session = await prisma.onboardingSession.findUnique({
    where: { id: sid },
    select: {
      id: true,
      source: true,
      leadId: true,
      partnerId: true,
      data: true,
    },
  });
  if (!session) return;

  const data = asDataRecord(session.data);
  const salesOwnerRaw = data.salesOwnerId;
  const salesOwnerId =
    typeof salesOwnerRaw === "string" && salesOwnerRaw.trim() ? salesOwnerRaw.trim() : null;
  const referralSource =
    typeof data.referralSource === "string" && data.referralSource.trim()
      ? data.referralSource.trim()
      : null;

  let sourceType: "direct" | "sales" | "franchise" = "direct";
  let sourceId: string | null = null;

  if (session.source === "FRANCHISE" || session.partnerId) {
    sourceType = "franchise";
    sourceId =
      session.partnerId ??
      (typeof data.franchisePartnerId === "string" ? data.franchisePartnerId.trim() || null : null);
  }
  if (session.source === "SALES" || session.leadId) {
    sourceType = "sales";
    sourceId = session.leadId ?? sourceId;
  }

  const companyPatch: {
    sourceType: "direct" | "sales" | "franchise";
    sourceId?: string | null;
    microFranchisePartnerId?: string;
  } = {
    sourceType,
    ...(sourceId ? { sourceId } : {}),
  };
  if (sourceType === "franchise" && session.partnerId) {
    companyPatch.microFranchisePartnerId = session.partnerId;
  }

  await prisma.company.update({
    where: { id: options.newCompanyId },
    data: companyPatch,
  });

  if (session.leadId) {
    const updated = await prisma.onboarding.updateMany({
      where: {
        leadId: session.leadId,
        status: OnboardingStatus.IN_PROGRESS,
        companyId: null,
      },
      data: {
        companyId: options.newCompanyId,
        status: OnboardingStatus.COMPLETED,
        meta: {
          salesOwnerId,
          referralSource,
          bossUserId: options.bossUserId,
        } as object,
      },
    });
    if (updated.count === 0) {
      const lead = await prisma.lead.findUnique({
        where: { id: session.leadId },
        select: { id: true },
      });
      if (lead) {
        await prisma.onboarding.create({
          data: {
            leadId: session.leadId,
            companyId: options.newCompanyId,
            createdBy: salesOwnerId ?? options.bossUserId,
            status: OnboardingStatus.COMPLETED,
            meta: {
              salesOwnerId,
              referralSource,
              bossUserId: options.bossUserId,
              createdFrom: "nexa_onboard_boss",
            } as object,
          },
        });
      }
    }
  }

  await prisma.onboardingSession.update({
    where: { id: sid },
    data: {
      companyId: options.newCompanyId,
      status: "launched",
      data: {
        ...data,
        attributionAppliedAt: new Date().toISOString(),
        referralSource: referralSource ?? data.referralSource ?? null,
      } as object,
    },
  });
}
