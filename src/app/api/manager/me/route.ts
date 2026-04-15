import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { jsonSuccess } from "@/lib/api-response";
import { requireActiveCompanyMembership } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;
  if (session.role !== UserRole.MANAGER) {
    return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const }, { status: 403 });
  }
  return jsonSuccess({
    role: session.role,
    companyId: session.companyId,
    userId: session.sub,
  });
}
