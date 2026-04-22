import bcrypt from "bcrypt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PASSWORD = "123456789";
const bodySchema = z.object({ employeeId: z.string().min(1) });

function canManage(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!canManage(session.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const membership = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: parsed.data.employeeId, companyId: session.companyId } },
    select: { userId: true, companyId: true },
  });
  if (!membership) {
    return NextResponse.json({ success: false, error: "Employee not found in your company" }, { status: 404 });
  }

  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await prisma.user.update({
    where: { id: membership.userId },
    data: { password },
  });

  await prisma.internalInAppNotification.create({
    data: {
      userId: membership.userId,
      companyId: membership.companyId,
      type: "PASSWORD_RESET",
      title: "Password reset",
      body: "Your password has been reset to 123456789 by HR. Please change it.",
    },
  });

  return NextResponse.json({ success: true });
}
