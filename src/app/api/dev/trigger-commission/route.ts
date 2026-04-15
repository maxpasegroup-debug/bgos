import { NextResponse } from "next/server";
import { z } from "zod";
import { accrueMicroFranchiseCommission } from "@/lib/micro-franchise-commission";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  companyId: z.string().cuid(),
  amount: z.number().positive().optional(),
  amountPaise: z.number().int().positive().optional(),
  paymentRef: z.string().trim().min(3).max(200).optional(),
});

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false as const, error: "Not available in production" },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const amountPaise =
    parsed.data.amountPaise ??
    (typeof parsed.data.amount === "number" ? Math.round(parsed.data.amount * 100) : 0);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return NextResponse.json(
      { ok: false as const, error: "Provide amount or amountPaise (> 0)" },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true, microFranchisePartnerId: true },
  });
  if (!company || !company.microFranchisePartnerId) {
    return NextResponse.json(
      { ok: false as const, error: "Company not linked to MF partner" },
      { status: 400 },
    );
  }

  const paymentRef =
    parsed.data.paymentRef?.trim() || `dev-trigger-${parsed.data.companyId}-${Date.now()}`;

  const partner = await prisma.microFranchisePartner.findUnique({
    where: { id: company.microFranchisePartnerId },
    select: { id: true, commissionPlanId: true },
  });
  if (!partner) {
    return NextResponse.json(
      { ok: false as const, error: "Linked MF partner not found" },
      { status: 400 },
    );
  }
  if (!partner.commissionPlanId) {
    let plan = await prisma.commissionPlan.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!plan) {
      plan = await prisma.commissionPlan.create({
        data: {
          name: "Default Plan",
          type: "PERCENTAGE",
          value: 10,
          recurring: true,
          instantBonus: 0,
        },
        select: { id: true },
      });
    }
    await prisma.microFranchisePartner.update({
      where: { id: partner.id },
      data: { commissionPlanId: plan.id },
    });
  }

  const result = await accrueMicroFranchiseCommission({
    companyId: parsed.data.companyId,
    amountPaise,
    paymentRef,
  });

  const wallet = await prisma.wallet.findUnique({
    where: { partnerId: company.microFranchisePartnerId },
    select: { pending: true, balance: true, totalEarned: true },
  });
  const tx = await prisma.commissionTransaction.findUnique({
    where: { paymentRef },
    select: { id: true, amount: true, status: true },
  });

  return NextResponse.json({
    ok: true as const,
    message: "Commission triggered",
    companyId: parsed.data.companyId,
    paymentRef,
    credited: result.credited,
    wallet,
    transaction: tx,
  });
}
