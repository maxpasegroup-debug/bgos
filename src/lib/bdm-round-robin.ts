import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getNextBdmId(companyId: string): Promise<string | null> {
  const bdms = await prisma.userCompany.findMany({
    where: { jobRole: UserRole.BDM },
    select: {
      userId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (bdms.length === 0) return null;
  if (bdms.length === 1) return bdms[0].userId;

  const lastAssigned = await prisma.lead.findFirst({
    where: {
      companyId,
      assignedTo: {
        in: bdms.map((bdm) => bdm.userId),
      },
    },
    orderBy: { createdAt: "desc" },
    select: { assignedTo: true },
  });

  if (!lastAssigned?.assignedTo) {
    return bdms[0].userId;
  }

  const lastIndex = bdms.findIndex((bdm) => bdm.userId === lastAssigned.assignedTo);
  const nextIndex = (lastIndex + 1) % bdms.length;
  return bdms[nextIndex].userId;
}
