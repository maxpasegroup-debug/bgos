import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, requireAuth } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * All companies the signed-in user belongs to (user-scoped by `session.sub`, not a single `companyId`).
 * Platform owner ({@link process.env.BGOS_BOSS_EMAIL} + JWT `superBoss`) receives every company.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const token = getTokenFromRequest(request);
  const vr = token ? verifyAccessTokenResult(token) : { ok: false as const };
  const payload = vr.ok ? (vr.payload as Record<string, unknown>) : null;
  const superBossList =
    payload?.superBoss === true && isSuperBossEmail(session.email) === true;

  if (superBossList) {
    const all = await prisma.company.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      ok: true as const,
      globalList: true as const,
      companies: all.map((c) => ({
        companyId: c.id,
        isOwner: c.ownerId === session.sub,
        name: c.name,
        industry: c.industry,
        plan: c.plan,
        role: "OWNER" as const,
        jobRole: "ADMIN" as const,
        joinedAt: c.createdAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        logoUrl: c.logoUrl,
        primaryColor: c.primaryColor,
        secondaryColor: c.secondaryColor,
        companyEmail: c.companyEmail ?? null,
        companyPhone: c.companyPhone ?? null,
        gstNumber: c.gstNumber ?? null,
        internalSalesOrg: c.internalSalesOrg === true,
      })),
    });
  }

  const rows = await prisma.userCompany.findMany({
    where: { userId: session.sub },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true as const,
    globalList: false as const,
    companies: rows.map((r) => ({
      companyId: r.companyId,
      isOwner: r.company.ownerId === session.sub,
      name: r.company.name,
      industry: r.company.industry,
      plan: r.company.plan,
      role: r.role,
      jobRole: r.jobRole,
      joinedAt: r.createdAt.toISOString(),
      createdAt: r.company.createdAt.toISOString(),
      logoUrl: r.company.logoUrl,
      primaryColor: r.company.primaryColor,
      secondaryColor: r.company.secondaryColor,
      companyEmail: (r.company as { companyEmail?: string | null }).companyEmail ?? null,
      companyPhone: (r.company as { companyPhone?: string | null }).companyPhone ?? null,
      gstNumber: (r.company as { gstNumber?: string | null }).gstNumber ?? null,
      internalSalesOrg: r.company.internalSalesOrg === true,
    })),
  });
}

