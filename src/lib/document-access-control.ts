import "server-only";

import type { AuthUserWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export type DocumentVaultScope = "all" | "mine";

/** Boss / owner sees all company documents. */
export async function resolveDocumentVaultScope(
  session: AuthUserWithCompany,
): Promise<DocumentVaultScope> {
  if (USER_ADMIN_ROLES.includes(session.role)) return "all";
  const co = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { ownerId: true },
  });
  if (co?.ownerId === session.sub) return "all";
  return "mine";
}

export async function getLeadIdsAssignedToUser(
  companyId: string,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.lead.findMany({
    where: { companyId, assignedTo: userId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export function employeeCanViewDocument(
  doc: {
    leadId: string | null;
    customerId?: string | null;
    uploadedByUserId: string | null;
  },
  userId: string,
  assignedLeadIds: Set<string>,
): boolean {
  if (doc.uploadedByUserId === userId) return true;
  if (doc.leadId && assignedLeadIds.has(doc.leadId)) return true;
  const customerId = doc.customerId ?? null;
  if (customerId && assignedLeadIds.has(customerId)) return true;
  return false;
}
