import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(32),
});

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.CHANNEL_PARTNER, UserRole.SALES_HEAD]);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try { json = await request.json(); } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const row = await (prisma as any).channelPartner.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      createdByUserId: session.sub,
    },
  });

  return NextResponse.json({
    ok: true as const,
    partner: {
      id: row.id,
      name: row.name,
      phone: row.phone,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
