import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function stockState(qty: number, min: number): "IN_STOCK" | "LOW" | "OUT" {
  if (qty <= 0) return "OUT";
  if (qty < min) return "LOW";
  return "IN_STOCK";
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const companyId = session.companyId;

  const filter = request.nextUrl.searchParams.get("filter")?.trim() ?? "all";

  const [stocks, logs] = await Promise.all([
    (prisma as any).stock.findMany({
      where: { companyId },
      include: { product: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    }),
    (prisma as any).stockLog.findMany({
      where: { companyId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 240,
    }),
  ]);

  let products = (stocks as any[]).map((s) => {
    const min = Number(s.product?.minStockLevel ?? 5);
    const qty = Number(s.quantity ?? 0);
    return {
      id: s.productId,
      stockId: s.id,
      name: s.product?.name ?? "Product",
      category: s.product?.category ?? "",
      unit: s.product?.unit ?? "pcs",
      minStockLevel: min,
      currentStock: qty,
      status: stockState(qty, min),
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  if (filter === "low_stock") products = products.filter((p) => p.status === "LOW");
  if (filter === "out_of_stock") products = products.filter((p) => p.status === "OUT");

  const byProduct = new Map<string, { in: number; out: number }>();
  for (const l of logs as any[]) {
    const p = byProduct.get(l.productId) ?? { in: 0, out: 0 };
    if (l.type === "IN") p.in += Number(l.quantity ?? 0);
    else p.out += Number(l.quantity ?? 0);
    byProduct.set(l.productId, p);
  }

  const usageHistory = (logs as any[]).map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.product?.name ?? "Product",
    type: l.type as "IN" | "OUT",
    quantity: Number(l.quantity ?? 0),
    usedFor:
      typeof l.reference === "string" && l.reference.toUpperCase().includes("SERVICE")
        ? "service"
        : typeof l.reference === "string" && l.reference.toUpperCase().includes("INSTALL")
          ? "installation"
          : "stock",
    reference: l.reference,
    date: l.createdAt.toISOString(),
  }));

  const overview = {
    totalProducts: products.length,
    inStockItems: products.filter((p) => p.status === "IN_STOCK").length,
    lowStockItems: products.filter((p) => p.status === "LOW").length,
    outOfStockItems: products.filter((p) => p.status === "OUT").length,
  };

  const alerts = products
    .filter((p) => p.status !== "IN_STOCK")
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      currentStock: p.currentStock,
      minStockLevel: p.minStockLevel,
      message: p.status === "OUT" ? "Out of stock alert" : "Low stock alert",
    }));

  return jsonSuccess({
    overview,
    products: products.map((p) => ({
      ...p,
      stockUsed: byProduct.get(p.id)?.out ?? 0,
      stockAdded: byProduct.get(p.id)?.in ?? 0,
      remainingStock: p.currentStock,
    })),
    usageHistory,
    alerts,
    insights: {
      insightLines: [
        `${overview.lowStockItems} items low in stock`,
        `${overview.outOfStockItems} items out of stock`,
      ],
      suggestionLines: [
        "Restock critical items",
        "Plan inventory for upcoming installs",
      ],
    },
  });
}
