import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().finite().positive(),
  reference: z.string().trim().min(1).max(250),
});

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [
    UserRole.INVENTORY_MANAGER,
    UserRole.OPERATIONS_HEAD,
    UserRole.INSTALLATION_TEAM,
  ]);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = schema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const p = parsed.data;

  const product = await (prisma as any).product.findFirst({
    where: { id: p.productId, companyId: session.companyId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ ok: false as const, error: "Product not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const stock = await (tx as any).stock.findUnique({
      where: {
        companyId_productId: {
          companyId: session.companyId,
          productId: p.productId,
        },
      },
    });

    const current = Number(stock?.quantity ?? 0);
    if (current < p.quantity) {
      throw new Error("NEGATIVE_STOCK");
    }

    const updated = await (tx as any).stock.upsert({
      where: {
        companyId_productId: {
          companyId: session.companyId,
          productId: p.productId,
        },
      },
      update: { quantity: current - p.quantity },
      create: { companyId: session.companyId, productId: p.productId, quantity: 0 },
    });

    await (tx as any).stockLog.create({
      data: {
        companyId: session.companyId,
        productId: p.productId,
        type: "OUT",
        quantity: p.quantity,
        reference: p.reference,
      },
    });

    return updated;
  }).catch((e) => {
    if (e instanceof Error && e.message === "NEGATIVE_STOCK") {
      return null;
    }
    throw e;
  });

  if (!result) {
    return NextResponse.json({ ok: false as const, error: "Insufficient stock", code: "NEGATIVE_STOCK" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true as const,
    stock: { id: result.id, productId: result.productId, quantity: result.quantity },
  });
}
