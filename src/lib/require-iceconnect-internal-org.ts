import "server-only";

import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function assertIceconnectInternalSalesOrg(
  companyId: string,
): Promise<ReturnType<typeof jsonError> | null> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { internalSalesOrg: true },
  });
  if (!c?.internalSalesOrg) {
    return jsonError(
      403,
      "NOT_INTERNAL_SALES_ORG",
      "This workspace is only available for internal sales organizations.",
    );
  }
  return null;
}
