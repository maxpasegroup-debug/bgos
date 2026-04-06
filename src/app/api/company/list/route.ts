import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * All companies the signed-in user belongs to (user-scoped by `session.sub`, not a single `companyId`).
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const rows = await prisma.userCompany.findMany({
    where: { userId: session.sub },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          industry: true,
          plan: true,
          ownerId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true as const,
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
    })),
  });
}
