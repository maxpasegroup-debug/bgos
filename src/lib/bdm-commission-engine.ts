import "server-only";

import { BdmEarningStatus, BdmEarningType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const COMMISSION_RATES = {
  DIRECT: {
    BASIC: 2000,
    PRO: 3000,
    ENTERPRISE: null,
  },
  RECURRING: {
    BASIC: 1000,
    PRO: 1500,
    ENTERPRISE: null,
  },
} as const;

type CommissionPlan = keyof typeof COMMISSION_RATES.DIRECT;

function normalizePlan(plan: string): CommissionPlan | null {
  const value = plan.trim().toUpperCase();
  if (value === "BASIC" || value === "PRO" || value === "ENTERPRISE") return value;
  return null;
}

export function getMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthString(): string {
  return getMonthString(new Date());
}

export function getMonthPeriod(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export function parseMonthString(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  const parsed = new Date(year, monthIndex, 1);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMonthLabel(month: string): string {
  const parsed = parseMonthString(month);
  if (!parsed) return month;
  return parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function monthsSince(start: Date, end: Date): number {
  const yearDelta = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDelta = end.getUTCMonth() - start.getUTCMonth();
  return yearDelta * 12 + monthDelta;
}

// Find BDM assigned to a client company from the earliest attributed lead.
export async function getBdmForClient(clientCompanyId: string): Promise<string | null> {
  const lead = await prisma.lead.findFirst({
    where: {
      companyId: clientCompanyId,
      assignedTo: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { assignedTo: true },
  });
  return lead?.assignedTo ?? null;
}

async function createPendingEarning(input: {
  bdmUserId: string;
  clientCompanyId: string;
  type: BdmEarningType;
  plan: string;
  amount: number;
  month: string;
  periodStart: Date;
  periodEnd: Date;
  paymentRef?: string | null;
  notes?: string | null;
}) {
  await prisma.bdmEarning.create({
    data: {
      bdmUserId: input.bdmUserId,
      clientCompanyId: input.clientCompanyId,
      type: input.type,
      plan: input.plan,
      amount: input.amount,
      month: input.month,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: BdmEarningStatus.PENDING,
      paymentRef: input.paymentRef ?? null,
      notes: input.notes ?? null,
    },
  });
}

// DIRECT commission — new subscription or one-off conversion event.
export async function processDirectCommission(input: {
  clientCompanyId: string;
  plan: string;
  paymentRef?: string;
  notes?: string;
}): Promise<void> {
  const bdmUserId = await getBdmForClient(input.clientCompanyId);
  if (!bdmUserId) {
    console.log("[commission] no BDM for client:", input.clientCompanyId);
    return;
  }

  const plan = normalizePlan(input.plan);
  if (!plan) {
    console.log("[commission] unsupported plan:", input.plan);
    return;
  }
  const amount = COMMISSION_RATES.DIRECT[plan];
  if (!amount) return;

  const now = new Date();
  const { start, end } = getMonthPeriod(now);
  const month = getMonthString(now);

  const existing = await prisma.bdmEarning.findFirst({
    where: {
      clientCompanyId: input.clientCompanyId,
      type: BdmEarningType.DIRECT,
      OR: [
        input.paymentRef
          ? { paymentRef: input.paymentRef }
          : { paymentRef: null, month },
      ],
    },
    select: { id: true },
  });
  if (existing) return;

  await createPendingEarning({
    bdmUserId,
    clientCompanyId: input.clientCompanyId,
    type: BdmEarningType.DIRECT,
    plan,
    amount,
    month,
    periodStart: start,
    periodEnd: end,
    paymentRef: input.paymentRef ?? null,
    notes: input.notes ?? null,
  });

  console.log(
    `[commission] DIRECT ₹${amount} for BDM ${bdmUserId} client ${input.clientCompanyId}`,
  );
}

// RECURRING commission — renewal month 2 onwards only.
export async function processRecurringCommission(input: {
  clientCompanyId: string;
  plan: string;
  paymentRef?: string;
  subscriptionStartDate: Date;
}): Promise<void> {
  const now = new Date();
  const monthsActive = monthsSince(input.subscriptionStartDate, now);
  if (monthsActive < 1) {
    console.log("[commission] skipping month 1 recurring");
    return;
  }

  const bdmUserId = await getBdmForClient(input.clientCompanyId);
  if (!bdmUserId) return;

  const plan = normalizePlan(input.plan);
  if (!plan) {
    console.log("[commission] unsupported plan:", input.plan);
    return;
  }
  const amount = COMMISSION_RATES.RECURRING[plan];
  if (!amount) return;

  const { start, end } = getMonthPeriod(now);
  const month = getMonthString(now);

  const existing = await prisma.bdmEarning.findFirst({
    where: {
      clientCompanyId: input.clientCompanyId,
      type: BdmEarningType.RECURRING,
      month,
    },
    select: { id: true },
  });
  if (existing) return;

  await createPendingEarning({
    bdmUserId,
    clientCompanyId: input.clientCompanyId,
    type: BdmEarningType.RECURRING,
    plan,
    amount,
    month,
    periodStart: start,
    periodEnd: end,
    paymentRef: input.paymentRef ?? null,
  });

  console.log(
    `[commission] RECURRING ₹${amount} for BDM ${bdmUserId} client ${input.clientCompanyId}`,
  );
}

// ENTERPRISE — manual boss entry.
export async function processEnterpriseBonus(input: {
  clientCompanyId: string;
  bdmUserId: string;
  amount: number;
  type: "DIRECT" | "RECURRING";
  notes: string;
  approvedBy: string;
}): Promise<void> {
  const now = new Date();
  const { start, end } = getMonthPeriod(now);

  await prisma.bdmEarning.create({
    data: {
      bdmUserId: input.bdmUserId,
      clientCompanyId: input.clientCompanyId,
      type: BdmEarningType.ENTERPRISE,
      plan: "ENTERPRISE",
      amount: Math.round(input.amount),
      month: getMonthString(now),
      periodStart: start,
      periodEnd: end,
      status: BdmEarningStatus.APPROVED,
      approvedBy: input.approvedBy,
      approvedAt: now,
      notes: `${input.type}: ${input.notes}`,
    },
  });
}

export function summarizeMonthStatus(statuses: BdmEarningStatus[]): BdmEarningStatus {
  if (statuses.includes(BdmEarningStatus.PENDING)) return BdmEarningStatus.PENDING;
  if (statuses.includes(BdmEarningStatus.APPROVED)) return BdmEarningStatus.APPROVED;
  return BdmEarningStatus.PAID;
}

export function aggregateByType(
  rows: Array<{ type: BdmEarningType; amount: number }>,
): { direct: number; recurring: number; enterprise: number; total: number } {
  const summary = { direct: 0, recurring: 0, enterprise: 0, total: 0 };
  for (const row of rows) {
    if (row.type === BdmEarningType.DIRECT) summary.direct += row.amount;
    else if (row.type === BdmEarningType.RECURRING) summary.recurring += row.amount;
    else summary.enterprise += row.amount;
    summary.total += row.amount;
  }
  return summary;
}

export type EarningsBreakdownRow = Prisma.BdmEarningGetPayload<{
  include: { clientCompany: { select: { id: true; name: true } } };
}>;
