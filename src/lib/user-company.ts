import "server-only";

import { prisma } from "./prisma";

export * from "./user-company-core";

export async function findUserInCompany(id: string, companyId: string) {
  const m = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: id, companyId } },
    include: { user: true },
  });
  return m?.user ?? null;
}

export async function getUserCompanyMembership(userId: string, companyId: string) {
  return prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
}
