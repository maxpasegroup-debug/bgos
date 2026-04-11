import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listInternalManagerUserIds(companyId: string): Promise<string[]> {
  const rows = await prisma.userCompany.findMany({
    where: {
      companyId,
      jobRole: { in: [UserRole.ADMIN, UserRole.MANAGER] },
    },
    include: { user: { select: { isActive: true } } },
  });
  return rows.filter((r) => r.user.isActive).map((r) => r.userId);
}

export async function listInternalTechUserIds(companyId: string): Promise<string[]> {
  const rows = await prisma.userCompany.findMany({
    where: {
      companyId,
      jobRole: {
        in: [UserRole.OPERATIONS_HEAD, UserRole.SITE_ENGINEER, UserRole.PRO, UserRole.INSTALLATION_TEAM],
      },
    },
    include: { user: { select: { isActive: true } } },
  });
  return rows.filter((r) => r.user.isActive).map((r) => r.userId);
}

export async function notifyInternalUsers(params: {
  companyId: string;
  userIds: string[];
  type: string;
  title: string;
  body: string;
  dedupeKey?: string;
}) {
  const { companyId, userIds, type, title, body, dedupeKey } = params;
  for (const userId of userIds) {
    if (dedupeKey) {
      await prisma.internalInAppNotification.upsert({
        where: {
          userId_dedupeKey: { userId, dedupeKey },
        },
        create: {
          companyId,
          userId,
          type,
          title,
          body,
          dedupeKey,
        },
        update: {},
      });
    } else {
      await prisma.internalInAppNotification.create({
        data: { companyId, userId, type, title, body },
      });
    }
  }
}
