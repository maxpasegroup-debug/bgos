import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) {
    return NextResponse.json({ ok: false as const, error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const users = await prisma.userCompany.findMany({
    where: { companyId: session.companyId, user: { isActive: true } },
    orderBy: { user: { name: "asc" } },
    select: {
      user: { select: { id: true, name: true, email: true } },
      jobRole: true,
    },
  });

  return NextResponse.json({
    ok: true as const,
    users: users.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.jobRole })),
  });
}
