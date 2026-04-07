import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const rows = await (prisma as any).product.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  return NextResponse.json({ ok: true as const, products: rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    createdAt: r.createdAt.toISOString(),
  })) });
}
