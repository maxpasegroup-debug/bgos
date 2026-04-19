import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const assignInclude = {
  assignee: { select: { id: true, name: true, email: true } as const },
} as const;

/**
 * CRM leads scoped to the internal sales org (optionally only those assigned to the caller).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const sp = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 20, 1), 100);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const scope = sp.get("scope") === "mine" ? "mine" : "all";

    const where: {
      companyId: string;
      assignedTo?: string;
    } = { companyId: org.companyId };

    if (scope === "mine") {
      where.assignedTo = session.sub;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: assignInclude,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      ok: true as const,
      leads: leads.map(serializeLead),
      total,
      limit,
      offset,
    });
  } catch (e) {
    logCaughtError("GET /api/internal/leads", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load leads", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
