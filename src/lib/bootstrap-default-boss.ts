import "server-only";

import { CompanyIndustry, CompanyPlan, Prisma, UserRole } from "@prisma/client";
import { withDbRetry } from "@/lib/db-retry";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { companyMembershipClass } from "@/lib/user-company";

export const DEFAULT_BOSS_EMAIL = "boss@bgos.online";
const DEFAULT_BOSS_PASSWORD_PLAIN = "123456";

/**
 * Fresh database: create default boss + company + membership so first login succeeds on BGOS and ICECONNECT.
 */
export async function ensureDefaultBossUser(): Promise<void> {
  await withDbRetry("ensureDefaultBossUser", async () => {
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    if (anyUser) return;

    const existingBoss = await prisma.user.findUnique({
      where: { email: DEFAULT_BOSS_EMAIL },
      select: { id: true },
    });
    if (existingBoss) return;

    console.info("[bootstrap] Empty database: creating default boss user", {
      email: DEFAULT_BOSS_EMAIL,
    });

    const passwordHash = await hashPassword(DEFAULT_BOSS_PASSWORD_PLAIN);

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: "Boss",
            email: DEFAULT_BOSS_EMAIL,
            password: passwordHash,
            workspaceActivatedAt: new Date(),
            isActive: true,
          },
        });
        const company = await tx.company.create({
          data: {
            name: "Default company",
            ownerId: user.id,
            industry: CompanyIndustry.SOLAR,
            plan: CompanyPlan.BASIC,
          },
        });
        await tx.userCompany.create({
          data: {
            userId: user.id,
            companyId: company.id,
            role: companyMembershipClass(UserRole.ADMIN),
            jobRole: UserRole.ADMIN,
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        console.warn("[bootstrap] Default boss race: user already exists (P2002), continuing");
        return;
      }
      throw e;
    }
  });
}
