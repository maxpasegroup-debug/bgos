import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicUser, USER_ADMIN_ROLES } from "@/lib/user-company";

/**
 * List all employees in the authenticated admin's company (no password fields).
 */
export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const memberships = await prisma.userCompany.findMany({
    where: { companyId: session.companyId, user: { isActive: true } },
    include: {
      user: true,
    },
  });

  memberships.sort((a, b) => a.user.name.localeCompare(b.user.name));

  return NextResponse.json({
    ok: true as const,
    users: memberships.map((m) => toPublicUser(m.user, m)),
  });
}
