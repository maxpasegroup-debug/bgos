import "server-only";

import { UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { companyMembershipClass } from "@/lib/user-company";
import { normalizeMicroFranchisePhone } from "@/lib/micro-franchise-phone";

const DEFAULT_PLAN_ID = "cmf_default_001";

function partnerLoginEmail(phoneDigits: string): string {
  return `mf.${phoneDigits}@partners.iceconnect.in`.toLowerCase();
}

async function uniquePartnerEmail(phoneDigits: string): Promise<string> {
  const base = partnerLoginEmail(phoneDigits);
  let i = 0;
  for (;;) {
    const candidate = i === 0 ? base : `mf.${phoneDigits}.${i}@partners.iceconnect.in`.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: candidate }, select: { id: true } });
    if (!exists) return candidate;
    i += 1;
  }
}

export type ActivateMicroFranchiseResult =
  | { ok: true; partnerId: string; userId: string; plainPassword: string; loginEmail: string }
  | { ok: false; error: string };

/**
 * Creates ICECONNECT user (MICRO_FRANCHISE), partner row, wallet, and links application.
 * Idempotent if partner already exists for application.
 */
export async function activateMicroFranchiseFromApplication(
  applicationId: string,
): Promise<ActivateMicroFranchiseResult> {
  const app = await prisma.microFranchiseApplication.findUnique({
    where: { id: applicationId },
    include: { partner: true },
  });
  if (!app) return { ok: false, error: "Application not found" };
  if (app.partner) {
    return {
      ok: true,
      partnerId: app.partner.id,
      userId: app.partner.userId,
      plainPassword: "",
      loginEmail: "",
    };
  }

  const phoneDigits = normalizeMicroFranchisePhone(app.phone);
  if (!phoneDigits) return { ok: false, error: "Invalid phone on application" };

  const dup = await prisma.microFranchisePartner.findUnique({
    where: { phone: phoneDigits },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "Partner already exists for this phone" };

  const internal = await getOrCreateInternalSalesCompanyId();
  if ("error" in internal) return { ok: false, error: internal.error };

  const planId =
    process.env.MICRO_FRANCHISE_DEFAULT_PLAN_ID?.trim() ||
    (await prisma.commissionPlan.findFirst({ where: { id: DEFAULT_PLAN_ID }, select: { id: true } }))?.id ||
    (await prisma.commissionPlan.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ||
    null;
  if (!planId) return { ok: false, error: "No commission plan configured" };

  const email = await uniquePartnerEmail(phoneDigits);
  const plainPassword = randomBytes(10).toString("base64url").slice(0, 14);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: app.name.trim(),
          email,
          password: await hashPassword(plainPassword),
          mobile: phoneDigits,
          isActive: true,
          workspaceActivatedAt: new Date(),
          firstLogin: true,
        },
        select: { id: true },
      });

      await tx.userCompany.create({
        data: {
          userId: user.id,
          companyId: internal.companyId,
          role: companyMembershipClass(UserRole.MICRO_FRANCHISE),
          jobRole: UserRole.MICRO_FRANCHISE,
        },
      });

      const partner = await tx.microFranchisePartner.create({
        data: {
          applicationId: app.id,
          name: app.name.trim(),
          phone: phoneDigits,
          email: app.email?.trim() || null,
          userId: user.id,
          commissionPlanId: planId,
        },
        select: { id: true },
      });

      await tx.wallet.create({
        data: {
          partnerId: partner.id,
        },
      });

      await tx.microFranchiseApplication.update({
        where: { id: app.id },
        data: { status: "APPROVED" },
      });

      return { partnerId: partner.id, userId: user.id, plainPassword, loginEmail: email };
    });

    return { ok: true, ...result };
  } catch (e) {
    console.error("[micro-franchise] activate failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Activation failed" };
  }
}
