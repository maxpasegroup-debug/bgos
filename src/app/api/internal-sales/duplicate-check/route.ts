import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import {
  findDuplicateInternalLeadDetailed,
  normalizeInternalSalesEmail,
  normalizeInternalSalesPhone,
} from "@/lib/internal-sales-org";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const phone = request.nextUrl.searchParams.get("phone") ?? "";
  const email = request.nextUrl.searchParams.get("email") ?? "";

  const normalizedPhone = normalizeInternalSalesPhone(phone);
  const normalizedEmail = normalizeInternalSalesEmail(email || null);

  if (!normalizedPhone && !normalizedEmail) {
    return jsonSuccess({ duplicate: false as const });
  }

  const dup = await findDuplicateInternalLeadDetailed(ctx.companyId, {
    normalizedPhone: normalizedPhone || undefined,
    normalizedEmail,
  });

  if (!dup) {
    return jsonSuccess({ duplicate: false as const });
  }

  return jsonSuccess({
    duplicate: true as const,
    match: dup.match,
    existingLead: {
      id: dup.id,
      name: dup.name,
      phone: dup.phone,
      email: dup.email,
    },
  });
}
