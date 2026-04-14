import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_EXECUTIVE];

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED);
    if (session instanceof NextResponse) return session;

    const rows = await prisma.launchChannelPartner.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { companies: true } },
      },
    });

    return NextResponse.json({
      ok: true as const,
      partners: rows.map((p) => ({
        id: p.id,
        phone: p.phone,
        name: p.name,
        totalRevenue: p.totalRevenue,
        conversions: p.conversions,
        companiesCount: p._count.companies,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { ok: false as const, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
