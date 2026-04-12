import "server-only";

import {
  CompanyIndustry,
  CompanyPlan,
  CompanySubscriptionStatus,
  InternalCallStatus,
  InternalSalesStage,
  LeadStatus,
  UserRole,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { companyMembershipClass } from "@/lib/user-company";
import type { AuthUserWithCompany } from "@/lib/auth";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { salesMetroLabel, SALES_METRO_STAGES } from "@/lib/internal-sales-metro";

export const INTERNAL_SALES_COMPANY_NAME = "BGOS Internal";

export const INTERNAL_SALES_STAGES: {
  key: InternalSalesStage;
  label: string;
}[] = [
  ...SALES_METRO_STAGES,
  { key: InternalSalesStage.CLOSED_LOST, label: "Closed Lost" },
];

export const INTERNAL_CALL_LABELS: Record<InternalCallStatus, string> = {
  [InternalCallStatus.NOT_CALLED]: "Not Called",
  [InternalCallStatus.CALLED]: "Called",
  [InternalCallStatus.NO_ANSWER]: "No Answer",
  [InternalCallStatus.INTERESTED]: "Interested",
  [InternalCallStatus.NOT_INTERESTED]: "Not Interested",
};

export function normalizeInternalSalesPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function internalStageToLeadStatus(stage: InternalSalesStage): LeadStatus {
  switch (stage) {
    case InternalSalesStage.LEAD_ADDED:
      return LeadStatus.NEW;
    case InternalSalesStage.INTRO_CALL:
      return LeadStatus.CONTACTED;
    case InternalSalesStage.DEMO_ORIENTATION:
      return LeadStatus.SITE_VISIT_SCHEDULED;
    case InternalSalesStage.FOLLOW_UP:
      return LeadStatus.NEGOTIATION;
    case InternalSalesStage.INTERESTED:
    case InternalSalesStage.ONBOARDING_FORM_FILLED:
      return LeadStatus.QUALIFIED;
    case InternalSalesStage.BOSS_APPROVAL_PENDING:
      return LeadStatus.QUALIFIED;
    case InternalSalesStage.SENT_TO_TECH:
    case InternalSalesStage.TECH_READY:
      return LeadStatus.PROPOSAL_SENT;
    case InternalSalesStage.DELIVERED:
      return LeadStatus.PROPOSAL_WON;
    case InternalSalesStage.CLIENT_LIVE:
      return LeadStatus.WON;
    case InternalSalesStage.CLOSED_LOST:
      return LeadStatus.LOST;
    default:
      return LeadStatus.NEW;
  }
}

export async function loadInternalSalesCompany(companyId: string) {
  return prisma.company.findFirst({
    where: { id: companyId, internalSalesOrg: true },
    select: {
      id: true,
      name: true,
      internalSalesOrg: true,
      internalSalesDefaultAssigneeId: true,
    },
  });
}

export function internalSalesForbidden(): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: "Open BGOS Internal in your company switcher to use team sales.",
      code: "INTERNAL_SALES_COMPANY_REQUIRED" as const,
    },
    { status: 403 },
  );
}

export async function assertInternalSalesSession(
  session: AuthUserWithCompany,
): Promise<NextResponse | { companyId: string }> {
  const co = await prisma.company.findFirst({
    where: { id: session.companyId, internalSalesOrg: true },
    select: { id: true },
  });
  if (!co) return internalSalesForbidden();
  return { companyId: co.id };
}

export function canManageInternalSalesAssignments(session: AuthUserWithCompany): boolean {
  return isIceconnectPrivileged(session.role);
}

export function leadVisibilityFilter(session: AuthUserWithCompany) {
  if (canManageInternalSalesAssignments(session)) return {};
  return { assignedTo: session.sub };
}

/**
 * Resolves the dedicated internal-sales tenant, creating it if missing (uses env or oldest user as owner).
 */
export async function getOrCreateInternalSalesCompanyId(): Promise<{ companyId: string } | { error: string }> {
  const byFlag = await prisma.company.findFirst({
    where: { internalSalesOrg: true },
    select: { id: true },
  });
  if (byFlag) return { companyId: byFlag.id };

  const byName = await prisma.company.findFirst({
    where: { name: INTERNAL_SALES_COMPANY_NAME },
    select: { id: true },
  });
  if (byName) {
    await prisma.company.update({
      where: { id: byName.id },
      data: { internalSalesOrg: true },
    });
    return { companyId: byName.id };
  }

  const envOwner = process.env.BGOS_INTERNAL_OWNER_USER_ID?.trim();
  let ownerId: string | null = null;
  if (envOwner) {
    const u = await prisma.user.findUnique({ where: { id: envOwner }, select: { id: true } });
    ownerId = u?.id ?? null;
  }
  if (!ownerId) {
    const first = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    ownerId = first?.id ?? null;
  }
  if (!ownerId) {
    return { error: "No user account exists yet to own the internal company." };
  }

  const created = await prisma.company.create({
    data: {
      name: INTERNAL_SALES_COMPANY_NAME,
      ownerId,
      industry: CompanyIndustry.SOLAR,
      plan: CompanyPlan.ENTERPRISE,
      subscriptionStatus: CompanySubscriptionStatus.ACTIVE,
      isTrialActive: false,
      internalSalesOrg: true,
    },
  });

  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: ownerId, companyId: created.id } },
    create: {
      userId: ownerId,
      companyId: created.id,
      role: companyMembershipClass(UserRole.ADMIN),
      jobRole: UserRole.ADMIN,
    },
    update: {
      role: companyMembershipClass(UserRole.ADMIN),
      jobRole: UserRole.ADMIN,
    },
  });

  return { companyId: created.id };
}

export async function findDuplicateInternalPhone(companyId: string, normalizedPhone: string) {
  if (!normalizedPhone) return null;
  const leads = await prisma.lead.findMany({
    where: { companyId },
    select: { id: true, phone: true },
  });
  for (const l of leads) {
    if (normalizeInternalSalesPhone(l.phone) === normalizedPhone) return l;
  }
  return null;
}

export function normalizeInternalSalesEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== "string") return null;
  const t = email.trim().toLowerCase();
  return t.length ? t : null;
}

export type InternalDuplicateMatch = "phone" | "email";

export async function findDuplicateInternalLeadDetailed(
  companyId: string,
  opts: { normalizedPhone?: string; normalizedEmail?: string | null },
): Promise<{
  match: InternalDuplicateMatch;
  id: string;
  name: string;
  phone: string;
  email: string | null;
} | null> {
  const leads = await prisma.lead.findMany({
    where: { companyId },
    select: { id: true, name: true, phone: true, email: true },
  });
  if (opts.normalizedPhone) {
    for (const l of leads) {
      if (normalizeInternalSalesPhone(l.phone) === opts.normalizedPhone) {
        return { match: "phone", id: l.id, name: l.name, phone: l.phone, email: l.email };
      }
    }
  }
  if (opts.normalizedEmail) {
    for (const l of leads) {
      const ne = normalizeInternalSalesEmail(l.email);
      if (ne && ne === opts.normalizedEmail) {
        return { match: "email", id: l.id, name: l.name, phone: l.phone, email: l.email };
      }
    }
  }
  return null;
}

/** Roles that may receive internal lead assignment (UI + API). */
export const INTERNAL_SALES_ASSIGNEE_ROLES: readonly UserRole[] = [
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

export function isInternalSalesAssignableRole(role: UserRole): boolean {
  return INTERNAL_SALES_ASSIGNEE_ROLES.includes(role);
}

export async function listInternalSalesTeamMembers(companyId: string) {
  const rows = await prisma.userCompany.findMany({
    where: { companyId, jobRole: { in: [...INTERNAL_SALES_ASSIGNEE_ROLES] } },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows
    .filter((r) => r.user.isActive)
    .map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      jobRole: r.jobRole,
    }));
}

export function stageLabel(stage: InternalSalesStage): string {
  return salesMetroLabel(stage);
}
