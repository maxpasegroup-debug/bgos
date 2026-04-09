import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getCustomerFromCookie();
  if (!auth) return jsonError(401, "UNAUTHORIZED", "Login required");

  const lead = await prisma.lead.findFirst({
    where: { id: auth.leadId, companyId: auth.companyId },
    select: { id: true, name: true, phone: true, source: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Customer not found");

  return jsonSuccess({
    leadId: lead.id,
    name: lead.name,
    mobile: lead.phone,
    location: lead.source ?? "",
  });
}
