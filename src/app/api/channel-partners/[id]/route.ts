import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_EXECUTIVE];

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;
    const partner = await prisma.launchChannelPartner.findUnique({
      where: { id },
      include: {
        companies: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            plan: true,
            industry: true,
            createdAt: true,
          },
        },
      },
    });
    if (!partner) {
      return NextResponse.json({ ok: false as const, error: "Partner not found", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true as const,
      partner: {
        id: partner.id,
        phone: partner.phone,
        name: partner.name,
        totalRevenue: partner.totalRevenue,
        conversions: partner.conversions,
        createdAt: partner.createdAt.toISOString(),
      },
      companies: partner.companies.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
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
