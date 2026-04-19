import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Tech queue rows for the active company (`tech_queue`).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const items = await prisma.techQueueEntry.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      ok: true as const,
      items: items.map((e) => ({
        id: e.id,
        request_id: e.requestId,
        status: e.status,
        assigned_to: e.assignedToUserId,
        assignee_name: e.assignedTo?.name ?? e.assignedTo?.email ?? null,
        created_at: e.createdAt.toISOString(),
        updated_at: e.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("GET /api/sales-network/tech-board", e);
    logCaughtError("sales-network-tech-board", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load tech board", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
