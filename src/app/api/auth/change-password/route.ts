import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm your new password"),
});

export async function POST(request: NextRequest) {
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const { oldPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { ok: false as const, error: "New password and confirmation do not match", code: "MISMATCH" },
      { status: 400 },
    );
  }
  if (oldPassword === newPassword) {
    return NextResponse.json(
      { ok: false as const, error: "New password must differ from the current password", code: "SAME_PASSWORD" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { password: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false as const, error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const ok = await verifyPassword(oldPassword, user.password);
  if (!ok) {
    return NextResponse.json(
      { ok: false as const, error: "Current password is incorrect", code: "INVALID_PASSWORD" },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: session.sub },
    data: { password: await hashPassword(newPassword), firstLogin: false },
  });

  return NextResponse.json({ ok: true as const });
}
