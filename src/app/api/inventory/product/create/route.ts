import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(1).max(250),
  category: z.enum(["Panel", "Inverter", "Battery", "Accessories"]),
  unit: z.string().trim().min(1).max(30),
});

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [
    UserRole.INVENTORY_MANAGER,
    UserRole.OPERATIONS_HEAD,
  ]);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = schema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid body", code: "VALIDATION" }, { status: 400 });
  }

  const row = await (prisma as any).product.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      category: parsed.data.category,
      unit: parsed.data.unit,
    },
  });

  await (prisma as any).stock.create({
    data: {
      companyId: session.companyId,
      productId: row.id,
      quantity: 0,
    },
  });

  return NextResponse.json({ ok: true as const, product: row });
}
