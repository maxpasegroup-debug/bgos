import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const bodySchema = z.object({
  confirm: z.literal("CLEAR_DEMO_DATA"),
  /** When `BGOS_DEMO_CLEAR_SECRET` is set in the environment, it must match. */
  secret: z.string().optional(),
});

/**
 * Removes seed-style demo tenants: users whose email ends with `@iceconnect.demo`
 * and all companies they own (cascades). Safe for production only when those
 * addresses are not used for real accounts.
 */
export async function POST(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const envSecret = process.env.BGOS_DEMO_CLEAR_SECRET?.trim();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" as const },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Confirmation required", code: "VALIDATION_ERROR" as const },
      { status: 400 },
    );
  }

  if (envSecret && parsed.data.secret !== envSecret) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid clear secret", code: "FORBIDDEN" as const },
      { status: 403 },
    );
  }

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@iceconnect.demo", mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const ids = demoUsers.map((u) => u.id);
  if (ids.length === 0) {
    return NextResponse.json({
      ok: true as const,
      removedUsers: 0,
      removedCompanies: 0,
      message: "No @iceconnect.demo users found.",
    });
  }

  const deletedCompanies = await prisma.company.deleteMany({
    where: { ownerId: { in: ids } },
  });

  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({
    ok: true as const,
    removedUsers: deletedUsers.count,
    removedCompanies: deletedCompanies.count,
    message: "Demo users and their owned companies were removed.",
  });
}
