import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, USER_ADMIN_ROLES } from "@/lib/user-company";

type RouteContext = { params: Promise<{ id: string }> };

function generateTempPassword(): string {
  const raw = randomBytes(10).toString("base64url");
  return raw.slice(0, 14);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  if (id === session.sub) {
    return NextResponse.json(
      { ok: false as const, error: "Use profile to change your own password", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const existing = await findUserInCompany(id, session.companyId);
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "User not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const temporaryPassword = generateTempPassword();
  const password = await hashPassword(temporaryPassword);

  await prisma.user.update({
    where: { id: existing.id },
    data: { password, firstLogin: true, forcePasswordReset: true },
  });

  await logActivity(prisma, {
    companyId: session.companyId,
    userId: session.sub,
    type: ACTIVITY_TYPES.TEAM_PASSWORD_RESET,
    message: `Password reset for ${existing.email}`,
    metadata: { targetUserId: id },
  });

  return NextResponse.json({
    ok: true as const,
    /** Shown once; there is no outbound email in this deployment. */
    temporaryPassword,
    message: "Share this password securely with the employee. They should change it after login.",
  });
}
