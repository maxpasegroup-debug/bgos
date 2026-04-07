import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const rows = await (prisma as any).stock.findMany({
    where: { companyId: session.companyId },
    include: { product: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 400,
  });

  const logs = await (prisma as any).stockLog.findMany({
    where: { companyId: session.companyId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    ok: true as const,
    stock: rows.map((r: any) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name ?? "Unknown",
      category: r.product?.category ?? "",
      unit: r.product?.unit ?? "",
      quantity: r.quantity,
      updatedAt: r.updatedAt.toISOString(),
      low: r.quantity <= 5,
    })),
    logs: logs.map((l: any) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name ?? "Unknown",
      type: l.type,
      quantity: l.quantity,
      reference: l.reference,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
