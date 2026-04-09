import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(1).max(250),
  category: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(30),
  minStockLevel: z.number().finite().min(0),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = createSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const row = await (prisma as any).product.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      category: parsed.data.category,
      unit: parsed.data.unit,
      minStockLevel: parsed.data.minStockLevel,
    },
  });
  await (prisma as any).stock.create({
    data: {
      companyId: session.companyId,
      productId: row.id,
      quantity: 0,
    },
  });
  return jsonSuccess({ id: row.id });
}
