import bcrypt from "bcrypt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { id: true, password: true },
  });
  if (!dbUser) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const valid = dbUser.password.startsWith("$2")
    ? await bcrypt.compare(parsed.data.currentPassword, dbUser.password)
    : parsed.data.currentPassword === dbUser.password;
  if (!valid) {
    return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { password: hashed },
  });
  return NextResponse.json({ success: true });
}
