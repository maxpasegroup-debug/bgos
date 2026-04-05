import { Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, USER_MUTATION_ROLES } from "@/lib/user-company";

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    mobile: z.string().trim().min(1).max(32).optional(),
    email: z.string().trim().email().optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

function publicUser(u: {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  companyId: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    name: u.name,
    mobile: u.mobile,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const parsed = patchBodySchema.safeParse(json);
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

  const data = parsed.data;
  const updateData: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.mobile !== undefined) updateData.mobile = data.mobile;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  try {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ ok: true as const, user: publicUser(user) });
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
