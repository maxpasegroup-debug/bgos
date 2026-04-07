import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithRoles } from "@/lib/auth";
import { expenseCategorySchema } from "@/lib/expense-categories";
import { roundMoney } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(400),
  amount: z.number().finite().positive(),
  category: expenseCategorySchema,
  date: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" as const },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid body", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const { title, amount, category, date: dateStr } = parsed.data;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid date", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const row = await prisma.expense.create({
    data: {
      companyId: session.companyId,
      title,
      amount: roundMoney(amount),
      category,
      date,
    },
  });

  return NextResponse.json({
    ok: true as const,
    expense: {
      id: row.id,
      title: row.title,
      amount: row.amount,
      category: row.category,
      date: row.date.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
  });
}
