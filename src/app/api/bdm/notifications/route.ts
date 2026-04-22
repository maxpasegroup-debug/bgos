import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    notificationId: z.string().trim().min(1).optional(),
    markAllRead: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.notificationId) || data.markAllRead === true, {
    message: "Provide notificationId or markAllRead=true.",
  });

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) {
    return NextResponse.json({ error: "No active company in session." }, { status: 400 });
  }

  const [unreadCount, notifications] = await Promise.all([
    prisma.internalInAppNotification.count({
      where: { userId: user.sub, companyId: user.companyId, readAt: null },
    }),
    prisma.internalInAppNotification.findMany({
      where: { userId: user.sub, companyId: user.companyId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.body,
      type: notification.type,
      createdAt: notification.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) {
    return NextResponse.json({ error: "No active company in session." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  if (parsed.data.markAllRead) {
    await prisma.internalInAppNotification.updateMany({
      where: { userId: user.sub, companyId: user.companyId, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.internalInAppNotification.updateMany({
    where: { id: parsed.data.notificationId, userId: user.sub, companyId: user.companyId, readAt: null },
    data: { readAt: now },
  });
  return NextResponse.json({ ok: true });
}
