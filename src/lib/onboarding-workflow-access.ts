import "server-only";

import type { OnboardingSubmission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthUserWithCompany } from "@/lib/auth";
import { canManageInternalSalesAssignments } from "@/lib/internal-sales-org";
import { WORKFLOW_CUSTOM_CATEGORY } from "@/lib/onboarding-workflow-templates";

export async function canAccessWorkflowSubmission(
  user: AuthUserWithCompany,
  sub: Pick<
    OnboardingSubmission,
    "companyId" | "filledByUserId" | "assignedTechUserId" | "leadId" | "category"
  >,
): Promise<"none" | "sales" | "tech" | "manager"> {
  if (user.companyId === sub.companyId) {
    if (canManageInternalSalesAssignments(user)) return "manager";

    const isTechStaff = user.role === "TECH_HEAD" || user.role === "TECH_EXECUTIVE";
    if (isTechStaff && sub.assignedTechUserId === user.sub) return "tech";

    if (sub.filledByUserId === user.sub) return "sales";

    if (sub.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: sub.leadId, companyId: sub.companyId },
        select: { assignedTo: true },
      });
      if (lead?.assignedTo === user.sub) return "sales";
    }

    return "none";
  }

  if (sub.category === WORKFLOW_CUSTOM_CATEGORY) {
    const viewerCo = await prisma.company.findFirst({
      where: { id: user.companyId, internalSalesOrg: true },
      select: { id: true },
    });
    if (!viewerCo) return "none";

    if (canManageInternalSalesAssignments(user)) return "manager";

    const isTechStaff = user.role === "TECH_HEAD" || user.role === "TECH_EXECUTIVE";
    if (isTechStaff && sub.assignedTechUserId === user.sub) return "tech";

    return "none";
  }

  return "none";
}

export function isTechRole(role: UserRole): boolean {
  return role === "TECH_HEAD" || role === "TECH_EXECUTIVE";
}
