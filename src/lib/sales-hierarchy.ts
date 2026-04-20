import "server-only";

import {
  IceconnectEmployeeRole,
  OnboardingRequestStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SalesHierarchyIds = {
  rsmId: string | null;
  bdmId: string | null;
  bdeId: string | null;
};

/**
 * Resolve RSM / BDM / BDE for a tenant company via completed onboarding → BDE → parent chain.
 */
export async function getSalesHierarchyForCompany(companyId: string): Promise<SalesHierarchyIds> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (!company) {
    return { rsmId: null, bdmId: null, bdeId: null };
  }

  const onboarding = await prisma.onboardingRequest.findFirst({
    where: {
      bossUserId: company.ownerId,
      status: OnboardingRequestStatus.COMPLETED,
    },
    orderBy: { updatedAt: "desc" },
    select: { createdByUserId: true },
  });
  if (!onboarding) {
    return { rsmId: null, bdmId: null, bdeId: null };
  }

  const bdeId = onboarding.createdByUserId;
  return walkIceconnectManagersFromBde(bdeId);
}

async function walkIceconnectManagersFromBde(bdeId: string): Promise<SalesHierarchyIds> {
  const bde = await prisma.user.findUnique({
    where: { id: bdeId },
    select: { id: true, parentId: true, iceconnectEmployeeRole: true },
  });
  if (!bde) {
    return { rsmId: null, bdmId: null, bdeId: null };
  }

  let bdmId: string | null = null;
  let rsmId: string | null = null;

  if (!bde.parentId) {
    return { rsmId: null, bdmId: null, bdeId: bde.id };
  }

  const parent = await prisma.user.findUnique({
    where: { id: bde.parentId },
    select: { id: true, parentId: true, iceconnectEmployeeRole: true },
  });
  if (!parent) {
    return { rsmId: null, bdmId: null, bdeId: bde.id };
  }

  if (parent.iceconnectEmployeeRole === IceconnectEmployeeRole.BDM) {
    bdmId = parent.id;
    if (parent.parentId) {
      const rsm = await prisma.user.findUnique({
        where: { id: parent.parentId },
        select: { id: true, iceconnectEmployeeRole: true },
      });
      if (rsm?.iceconnectEmployeeRole === IceconnectEmployeeRole.RSM) {
        rsmId = rsm.id;
      }
    }
  } else if (parent.iceconnectEmployeeRole === IceconnectEmployeeRole.RSM) {
    rsmId = parent.id;
  }

  return { rsmId, bdmId, bdeId: bde.id };
}

/** Direct BDEs under an RSM plus BDEs under each BDM child. */
export async function getBdeIdsUnderRsm(rsmId: string): Promise<string[]> {
  const children = await prisma.user.findMany({
    where: { parentId: rsmId },
    select: { id: true, iceconnectEmployeeRole: true },
  });
  const out = new Set<string>();
  for (const c of children) {
    if (c.iceconnectEmployeeRole === IceconnectEmployeeRole.BDE) {
      out.add(c.id);
    }
    if (c.iceconnectEmployeeRole === IceconnectEmployeeRole.BDM) {
      const bdes = await prisma.user.findMany({
        where: {
          parentId: c.id,
          iceconnectEmployeeRole: IceconnectEmployeeRole.BDE,
        },
        select: { id: true },
      });
      for (const b of bdes) out.add(b.id);
    }
  }
  return [...out];
}

/** Company ids whose onboarding was created by this BDE (completed requests only). */
export async function getCompanyIdsForBde(bdeId: string): Promise<string[]> {
  const rows = await prisma.onboardingRequest.findMany({
    where: {
      createdByUserId: bdeId,
      status: OnboardingRequestStatus.COMPLETED,
      bossUserId: { not: null },
    },
    select: { bossUserId: true },
  });
  const ownerIds = [...new Set(rows.map((r) => r.bossUserId).filter(Boolean) as string[])];
  if (ownerIds.length === 0) return [];
  const companies = await prisma.company.findMany({
    where: { ownerId: { in: ownerIds } },
    select: { id: true },
  });
  return companies.map((c) => c.id);
}

export async function getCompanyIdsForBdm(bdmId: string): Promise<string[]> {
  const bdes = await prisma.user.findMany({
    where: {
      parentId: bdmId,
      iceconnectEmployeeRole: IceconnectEmployeeRole.BDE,
    },
    select: { id: true },
  });
  const ids = new Set<string>();
  for (const b of bdes) {
    for (const cid of await getCompanyIdsForBde(b.id)) {
      ids.add(cid);
    }
  }
  return [...ids];
}

export async function getCompanyIdsForRsm(rsmId: string): Promise<string[]> {
  const bdeIds = await getBdeIdsUnderRsm(rsmId);
  const ids = new Set<string>();
  for (const b of bdeIds) {
    for (const cid of await getCompanyIdsForBde(b)) {
      ids.add(cid);
    }
  }
  return [...ids];
}
