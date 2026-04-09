import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse, jsonError } from "@/lib/api-response";
import { setCustomerSessionCookie, signCustomerToken } from "@/lib/customer-auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  mobile: z.string().trim().min(6).max(32),
  password: z.string().min(6).max(128),
});

export async function POST(request: Request) {
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const mobile = parsed.data.mobile.trim();
  const row = await (prisma as any).customerPortalUser.findFirst({
    where: { mobile, isActive: true },
    include: { lead: { select: { id: true, companyId: true, name: true } } },
  });
  if (!row) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const ok = await verifyPassword(parsed.data.password, row.passwordHash as string);
  if (!ok) return jsonError(401, "UNAUTHORIZED", "Invalid credentials");

  const token = await signCustomerToken({
    leadId: row.leadId as string,
    companyId: row.companyId as string,
    mobile,
  });
  const res = NextResponse.json({
    ok: true as const,
    customer: { leadId: row.leadId as string, name: row.lead?.name ?? "Customer" },
  });
  setCustomerSessionCookie(res, token);
  return res;
}
