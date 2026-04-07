import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) {
    return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const row = await (prisma as any).leaveRequest.findFirst({
    where: { id: parsed.data.id, companyId: session.companyId },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ ok: false as const, error: "Leave not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const updated = await (prisma as any).leaveRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true as const, leave: { id: updated.id, status: updated.status } });
}
