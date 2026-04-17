import { Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import {
  findUserInCompany,
  getUserCompanyMembership,
  toPublicUser,
  USER_ADMIN_ROLES,
} from "@/lib/user-company";

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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
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

  if (data.role !== undefined) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Role changes are locked. Roles can only be assigned during onboarding or backend admin flow.",
        code: "FORBIDDEN_ROLE_CHANGE" as const,
      },
      { status: 403 },
    );
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.mobile !== undefined) updateData.mobile = data.mobile;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  try {
    const user = await prisma.$transaction(async (tx) => {
      return tx.user.update({
        where: { id: existing.id },
        data: updateData,
      });
    });

    const m = await getUserCompanyMembership(user.id, session.companyId);
    if (!m) {
      return NextResponse.json(
        { ok: false as const, error: "Membership not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    await logActivity(prisma, {
      companyId: session.companyId,
      userId: session.sub,
      type: ACTIVITY_TYPES.TEAM_MEMBER_UPDATED,
      message: `Team member updated: ${user.email}`,
      metadata: { targetUserId: id },
    });

    return NextResponse.json({ ok: true as const, user: toPublicUser(user, m) });
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await context.params;
  if (id === session.sub) {
    return NextResponse.json(
      { ok: false as const, error: "You cannot delete your own account", code: "FORBIDDEN" as const },
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

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { ownerId: true },
  });
  if (company?.ownerId === id) {
    return NextResponse.json(
      { ok: false as const, error: "Cannot remove the company owner from the team", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.userCompany.delete({
      where: { userId_companyId: { userId: id, companyId: session.companyId } },
    });
    const remaining = await tx.userCompany.count({ where: { userId: id } });
    if (remaining === 0) {
      await tx.user.delete({ where: { id } });
    }
  });

  await logActivity(prisma, {
    companyId: session.companyId,
    userId: session.sub,
    type: ACTIVITY_TYPES.TEAM_MEMBER_DELETED,
    message: `Team member removed from company: ${existing.email}`,
    metadata: { targetUserId: id },
  });

  return NextResponse.json({ ok: true as const });
}
