import { BdmEarningStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  aggregateByType,
  currentMonthString,
  summarizeMonthStatus,
} from "@/lib/bdm-commission-engine";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = new Set<UserRole>([UserRole.BDM, UserRole.ADMIN, UserRole.MANAGER]);

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = currentMonthString();
  const rows = await prisma.bdmEarning.findMany({
    where: {
      bdmUserId: session.sub,
      bdmUser: {
        memberships: {
          some: { companyId: session.companyId },
        },
      },
    },
    include: {
      clientCompany: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });

  const currentRows = rows.filter((row) => row.month === month);
  const currentSummary = aggregateByType(currentRows);
  const currentStatuses = currentRows.map((row) => row.status);

  const grouped = new Map<
    string,
    {
      rows: typeof rows;
      direct: number;
      recurring: number;
      enterprise: number;
      total: number;
      status: BdmEarningStatus;
    }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.month);
    const totals = aggregateByType([row]);
    if (!existing) {
      grouped.set(row.month, {
        rows: [row],
        direct: totals.direct,
        recurring: totals.recurring,
        enterprise: totals.enterprise,
        total: totals.total,
        status: row.status,
      });
      continue;
    }
    existing.rows.push(row);
    existing.direct += totals.direct;
    existing.recurring += totals.recurring;
    existing.enterprise += totals.enterprise;
    existing.total += totals.total;
    existing.status = summarizeMonthStatus(existing.rows.map((item) => item.status));
  }

  const history = [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, entry]) => ({
      month: monthKey,
      direct: entry.direct,
      recurring: entry.recurring,
      enterprise: entry.enterprise,
      total: entry.total,
      status: entry.status,
    }));

  const totalEarned = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalPaid = rows
    .filter((row) => row.status === BdmEarningStatus.PAID)
    .reduce((sum, row) => sum + row.amount, 0);
  const pendingAmount = rows
    .filter((row) => row.status === BdmEarningStatus.PENDING)
    .reduce((sum, row) => sum + row.amount, 0);
  const activeClients = new Set(
    rows
      .filter((row) => row.type === "RECURRING")
      .map((row) => row.clientCompanyId),
  ).size;
  const topHistory = history.reduce<{ month: string; amount: number } | null>((best, entry) => {
    if (!best || entry.total > best.amount) {
      return { month: entry.month, amount: entry.total };
    }
    return best;
  }, null);

  return NextResponse.json({
    currentMonth: {
      month,
      direct: currentSummary.direct,
      recurring: currentSummary.recurring,
      enterprise: currentSummary.enterprise,
      total: currentSummary.total,
      status: currentStatuses.length ? summarizeMonthStatus(currentStatuses) : BdmEarningStatus.PENDING,
    },
    breakdown: currentRows.map((row) => ({
      id: row.id,
      type: row.type,
      plan: row.plan,
      amount: row.amount,
      clientName: row.clientCompany.name,
      month: row.month,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    history,
    stats: {
      totalEarned,
      totalPaid,
      pendingAmount,
      activeClients,
      topMonth: topHistory ?? {
        month,
        amount: currentSummary.total,
      },
    },
  });
}
