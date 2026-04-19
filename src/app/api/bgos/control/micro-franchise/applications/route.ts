import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const rows = await prisma.microFranchiseApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        referredBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        partner: { select: { id: true } },
      },
    });

    return NextResponse.json({
      ok: true as const,
      applications: rows.map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone,
        email: a.email,
        location: a.location,
        experience: a.experience,
        status: a.status,
        referredBy: a.referredBy
          ? { id: a.referredBy.id, name: a.referredBy.name, email: a.referredBy.email }
          : null,
        assignedTo: a.assignedTo
          ? { id: a.assignedTo.id, name: a.assignedTo.name, email: a.assignedTo.email }
          : null,
        hasPartner: Boolean(a.partner),
        createdAt: a.createdAt.toISOString(),
        notes: a.notes,
      })),
    });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/micro-franchise/applications", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load applications", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
