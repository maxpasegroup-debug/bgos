import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicUser, USER_ADMIN_ROLES } from "@/lib/user-company";

/**
 * List all employees in the authenticated admin's company (no password fields).
 */
export async function GET(request: NextRequest) {
  const session = requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const users = await prisma.user.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      role: true,
      companyId: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true as const,
    users: users.map((u) => toPublicUser(u)),
  });
}
