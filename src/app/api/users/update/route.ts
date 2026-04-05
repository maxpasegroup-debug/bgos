import { Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, toPublicUser, USER_ADMIN_ROLES } from "@/lib/user-company";

const updateBodySchema = z
  .object({
    id: z.string().trim().min(1, "User id is required"),
    name: z.string().trim().min(1).max(200).optional(),
    mobile: z.string().trim().min(1).max(32).optional(),
    email: z.string().trim().email().optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.mobile !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.isActive !== undefined,
    { message: "Provide at least one field to update" },
  );

/**
 * Update an employee in the same company (ADMIN only). Preferred over PATCH /api/users/[id].
 */
export async function PATCH(request: NextRequest) {
  const session = requireAuthWithRoles(request, USER_ADMIN_ROLES);
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

  const parsed = updateBodySchema.safeParse(json);
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

  const { id: targetId, ...fields } = parsed.data;

  const existing = await findUserInCompany(targetId, session.companyId);
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "User not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.mobile !== undefined) updateData.mobile = fields.mobile;
  if (fields.email !== undefined) updateData.email = fields.email.toLowerCase();
  if (fields.role !== undefined) updateData.role = fields.role;
  if (fields.isActive !== undefined) updateData.isActive = fields.isActive;

  try {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ ok: true as const, user: toPublicUser(user) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { ok: false as const, error: "Email is already in use", code: "DUPLICATE_EMAIL" },
        { status: 409 },
      );
    }
    throw e;
  }
}
