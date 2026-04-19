import type { PrismaClient } from "@prisma/client";
import { nexaAddress } from "@/lib/nexa-voice/framework";

export type MicroWinKey = "first_lead" | "first_activity" | "first_sale";

const MESSAGES: Record<MicroWinKey, string> = {
  first_lead: "Good start. Your first lead is in the system. Advance it one stage today.",
  first_activity: "First logged action recorded. Repeat tomorrow to build the habit.",
  first_sale: "First subscription recorded. Reinforce the behavior while momentum is high.",
};

export async function loadPersuasionState(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<{ id: string; celebratedWins: string[] }> {
  const row = await prisma.nexaPersuasionState.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: { companyId, userId, celebratedWins: [] },
    update: {},
  });
  return { id: row.id, celebratedWins: row.celebratedWins ?? [] };
}

/**
 * Returns at most one new micro-win line per call (highest priority first).
 */
export async function resolveMicroWin(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
  firstName: string | null,
  state: { id: string; celebratedWins: string[] },
): Promise<{ key: MicroWinKey; text: string } | null> {
  const celebrated = new Set(state.celebratedWins);

  const [leadCount, activityCount, saleCount] = await Promise.all([
    prisma.lead.count({
      where: {
        companyId,
        OR: [{ assignedTo: userId }, { createdByUserId: userId }],
      },
    }),
    prisma.activityLog.count({ where: { companyId, userId } }),
    prisma.salesHierarchySubscription.count({ where: { companyId, ownerUserId: userId } }),
  ]);

  const checks: { key: MicroWinKey; ok: boolean }[] = [
    { key: "first_sale", ok: saleCount >= 1 },
    { key: "first_lead", ok: leadCount >= 1 },
    { key: "first_activity", ok: activityCount >= 1 },
  ];

  for (const c of checks) {
    if (!c.ok || celebrated.has(c.key)) continue;
    await prisma.nexaPersuasionState.update({
      where: { id: state.id },
      data: { celebratedWins: [...state.celebratedWins, c.key] },
    });
    const addr = nexaAddress(firstName);
    return { key: c.key, text: `${addr}${MESSAGES[c.key]}` };
  }
  return null;
}
