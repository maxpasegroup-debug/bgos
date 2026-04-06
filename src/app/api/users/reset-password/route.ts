import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Set a new password for an employee in the same company (ADMIN only).
 * User stays active and can sign in via email or mobile + password (ICECONNECT).
 */
export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        error: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const { userId, password } = parsed.data;

  const existing = await findUserInCompany(userId, session.companyId);
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "User not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      password: passwordHash,
      isActive: true,
    },
  });

  return NextResponse.json({
    ok: true as const,
    message: "Password updated. Employee can sign in with the new password.",
  });
}
