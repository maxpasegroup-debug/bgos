import "server-only";

import { prisma } from "@/lib/prisma";

export type CompanyLimitsDto = {
  max_users: number;
  max_leads: number;
  max_projects: number;
};

/** Snapshot from {@link CompanyLimit} (row created with defaults if missing). */
export async function getCompanyLimits(companyId: string): Promise<CompanyLimitsDto> {
  const row = await ensureCompanyLimits(companyId);
  return {
    max_users: row.maxUsers,
    max_leads: row.maxLeads,
    max_projects: row.maxProjects,
  };
}

export type LimitKind = "user" | "lead" | "project";

export type CompanyLimitCheck =
  | { ok: true }
  | { ok: false; message: string; kind: LimitKind };

/**
 * Ensures a {@link CompanyLimit} row exists (defaults applied on first access).
 */
export async function ensureCompanyLimits(companyId: string) {
  return prisma.companyLimit.upsert({
    where: { companyId },
    create: {
      companyId,
      maxUsers: 12,
      maxLeads: 300,
      maxProjects: 50,
    },
    update: {},
  });
}

export async function getCompanyUsage(companyId: string) {
  const [limits, userCount, leadCount, projectCount] = await Promise.all([
    ensureCompanyLimits(companyId),
    prisma.userCompany.count({ where: { companyId, archivedAt: null } }),
    prisma.lead.count({ where: { companyId } }),
    prisma.deal.count({ where: { companyId } }),
  ]);
  return {
    limits,
    userCount,
    leadCount,
    projectCount,
  };
}

/** Block creation when at or over cap (strict &gt;). */
export async function checkCompanyLimit(
  companyId: string,
  kind: LimitKind,
): Promise<CompanyLimitCheck> {
  const u = await getCompanyUsage(companyId);
  const { limits } = u;
  if (kind === "user" && u.userCount >= limits.maxUsers) {
    return {
      ok: false,
      kind,
      message: "Upgrade plan to continue — user limit reached for your workspace.",
    };
  }
  if (kind === "lead" && u.leadCount >= limits.maxLeads) {
    return {
      ok: false,
      kind,
      message: "Upgrade plan to continue — lead limit reached.",
    };
  }
  if (kind === "project" && u.projectCount >= limits.maxProjects) {
    return {
      ok: false,
      kind,
      message: "Upgrade plan to continue — project limit reached.",
    };
  }
  return { ok: true };
}
