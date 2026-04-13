import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { ok: false as const, error: "Provide at least one field", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const update: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email.toLowerCase();

  try {
    const user = await prisma.user.update({
      where: { id: session.sub },
      data: update,
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ ok: true as const, user });
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
