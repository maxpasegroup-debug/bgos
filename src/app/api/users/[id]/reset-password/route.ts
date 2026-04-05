import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, USER_MUTATION_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Set a new password for an employee (same company). User remains active and can sign in immediately.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = requireAuthWithRoles(request, USER_MUTATION_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;

  const existing = await findUserInCompany(id, session.companyId);
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "User not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

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

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      password: passwordHash,
      isActive: true,
    },
  });

  return NextResponse.json({
    ok: true as const,
    message: "Password updated. User can sign in with the new password.",
  });
}
