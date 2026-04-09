import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const addSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().finite().positive(),
  date: z.string().optional(),
});

const useSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().finite().positive(),
  usedFor: z.enum(["installation", "service"]),
  referenceId: z.string().optional(),
  date: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const sp = request.nextUrl.searchParams;
  const mode = sp.get("mode")?.trim() ?? "add";

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  if (mode === "use") {
    const parsed = useSchema.safeParse(raw.data);
    if (!parsed.success) return zodValidationErrorResponse(parsed.error);
    const p = parsed.data;

    const stock = await (prisma as any).stock.findUnique({
      where: {
        companyId_productId: { companyId: session.companyId, productId: p.productId },
      },
      include: { product: true },
    });
    if (!stock) return jsonError(404, "NOT_FOUND", "Stock row not found");
    if (Number(stock.quantity) < p.quantity) {
      return jsonError(409, "NEGATIVE_STOCK", "Insufficient stock");
    }
    const nextQty = Number(stock.quantity) - p.quantity;
    await prisma.$transaction([
      (prisma as any).stock.update({
        where: { id: stock.id },
        data: { quantity: nextQty },
      }),
      (prisma as any).stockLog.create({
        data: {
          companyId: session.companyId,
          productId: p.productId,
          type: "OUT",
          quantity: p.quantity,
          reference: `${p.usedFor.toUpperCase()}${p.referenceId ? `:${p.referenceId}` : ""}`,
          createdAt: p.date ? new Date(p.date) : undefined,
        },
      }),
    ]);
    return jsonSuccess({ ok: true });
  }

  const parsed = addSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);
  const p = parsed.data;

  const stock = await (prisma as any).stock.findUnique({
    where: {
      companyId_productId: { companyId: session.companyId, productId: p.productId },
    },
  });
  const nextQty = Number(stock?.quantity ?? 0) + p.quantity;
  await prisma.$transaction([
    (prisma as any).stock.upsert({
      where: { companyId_productId: { companyId: session.companyId, productId: p.productId } },
      update: { quantity: nextQty },
      create: { companyId: session.companyId, productId: p.productId, quantity: nextQty },
    }),
    (prisma as any).stockLog.create({
      data: {
        companyId: session.companyId,
        productId: p.productId,
        type: "IN",
        quantity: p.quantity,
        reference: "RESTOCK",
        createdAt: p.date ? new Date(p.date) : undefined,
      },
    }),
  ]);
  return jsonSuccess({ ok: true });
}
