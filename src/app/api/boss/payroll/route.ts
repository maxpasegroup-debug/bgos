import { BdmEarningStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  aggregateByType,
  currentMonthString,
  summarizeMonthStatus,
} from "@/lib/bdm-commission-engine";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.MANAGER]);

const patchSchema = z
  .object({
    action: z.enum(["APPROVE", "MARK_PAID"]),
    earningIds: z.array(z.string().trim().min(1)).optional(),
    bdmUserId: z.string().trim().min(1).optional(),
    approveAll: z.boolean().optional(),
    month: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
  })
  .refine((value) => Boolean(value.earningIds?.length || value.bdmUserId || value.approveAll), {
    message: "Select earnings, a BDM, or approveAll.",
    path: ["earningIds"],
  });

function normalizeName(name: string | null, email: string): string {
  if (name?.trim()) return name.trim();
  const local = email.split("@")[0] ?? "BDM";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const selectedMonth = request.nextUrl.searchParams.get("month")?.trim() || currentMonthString();
  const bdmIds = (
    await prisma.userCompany.findMany({
      where: { companyId: session.companyId, jobRole: UserRole.BDM },
      select: { userId: true },
    })
  ).map((row) => row.userId);

  const [rows, bdmMemberships, clientCompanies, months] = await Promise.all([
    prisma.bdmEarning.findMany({
      where: {
        month: selectedMonth,
        bdmUser: {
          memberships: {
            some: {
              companyId: session.companyId,
              jobRole: UserRole.BDM,
            },
          },
        },
      },
      include: {
        bdmUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.userCompany.findMany({
      where: { companyId: session.companyId, jobRole: UserRole.BDM },
      select: {
        userId: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.company.findMany({
      where: {
        leads: {
          some: {
            assignedTo: {
              in: bdmIds,
            },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.bdmEarning.findMany({
      where: {
        bdmUser: {
          memberships: {
            some: {
              companyId: session.companyId,
              jobRole: UserRole.BDM,
            },
          },
        },
      },
      distinct: ["month"],
      select: { month: true },
      orderBy: { month: "desc" },
    }),
  ]);

  const grouped = new Map<
    string,
    {
      bdmUserId: string;
      bdmName: string;
      bdmEmail: string;
      direct: number;
      recurring: number;
      enterprise: number;
      total: number;
      status: BdmEarningStatus;
      earningIds: string[];
      statuses: BdmEarningStatus[];
    }
  >();

  for (const row of rows) {
    const current = grouped.get(row.bdmUserId);
    const amounts = aggregateByType([row]);
    if (!current) {
      grouped.set(row.bdmUserId, {
        bdmUserId: row.bdmUserId,
        bdmName: normalizeName(row.bdmUser.name, row.bdmUser.email),
        bdmEmail: row.bdmUser.email,
        direct: amounts.direct,
        recurring: amounts.recurring,
        enterprise: amounts.enterprise,
        total: amounts.total,
        status: row.status,
        earningIds: [row.id],
        statuses: [row.status],
      });
      continue;
    }

    current.direct += amounts.direct;
    current.recurring += amounts.recurring;
    current.enterprise += amounts.enterprise;
    current.total += amounts.total;
    current.earningIds.push(row.id);
    current.statuses.push(row.status);
    current.status = summarizeMonthStatus(current.statuses);
  }

  const bdms = [...grouped.values()]
    .map((entry) => ({
      bdmUserId: entry.bdmUserId,
      bdmName: entry.bdmName,
      bdmEmail: entry.bdmEmail,
      direct: entry.direct,
      recurring: entry.recurring,
      enterprise: entry.enterprise,
      total: entry.total,
      status: entry.status,
      earningIds: entry.earningIds,
    }))
    .sort((a, b) => b.total - a.total);

  const totals = {
    totalPending: rows
      .filter((row) => row.status === BdmEarningStatus.PENDING)
      .reduce((sum, row) => sum + row.amount, 0),
    totalApproved: rows
      .filter((row) => row.status === BdmEarningStatus.APPROVED)
      .reduce((sum, row) => sum + row.amount, 0),
    totalPaid: rows
      .filter((row) => row.status === BdmEarningStatus.PAID)
      .reduce((sum, row) => sum + row.amount, 0),
    grandTotal: rows.reduce((sum, row) => sum + row.amount, 0),
  };

  return NextResponse.json({
    currentMonth: selectedMonth,
    bdms,
    totals,
    availableMonths: months.map((row) => row.month),
    bdmOptions: bdmMemberships.map((row) => ({
      id: row.userId,
      name: normalizeName(row.user.name, row.user.email),
      email: row.user.email,
    })),
    clientOptions: clientCompanies.map((row) => ({
      id: row.id,
      name: row.name,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const month = payload.month ?? currentMonthString();
  const baseWhere = {
    month,
    bdmUser: {
      memberships: {
        some: {
          companyId: session.companyId,
          jobRole: UserRole.BDM,
        },
      },
    },
  } as const;

  const targetRows = await prisma.bdmEarning.findMany({
    where: {
      ...baseWhere,
      ...(payload.earningIds?.length ? { id: { in: payload.earningIds } } : {}),
      ...(payload.bdmUserId ? { bdmUserId: payload.bdmUserId } : {}),
      ...(payload.approveAll ? {} : {}),
    },
    select: { id: true, status: true },
  });

  if (targetRows.length === 0) {
    return NextResponse.json({ error: "No matching earnings found." }, { status: 404 });
  }

  const now = new Date();
  let updatedCount = 0;

  if (payload.action === "APPROVE") {
    const ids = targetRows.filter((row) => row.status === BdmEarningStatus.PENDING).map((row) => row.id);
    if (ids.length > 0) {
      const result = await prisma.bdmEarning.updateMany({
        where: { id: { in: ids } },
        data: {
          status: BdmEarningStatus.APPROVED,
          approvedBy: session.sub,
          approvedAt: now,
        },
      });
      updatedCount = result.count;
    }
  } else {
    const ids = targetRows.filter((row) => row.status === BdmEarningStatus.APPROVED).map((row) => row.id);
    if (ids.length > 0) {
      const result = await prisma.bdmEarning.updateMany({
        where: { id: { in: ids } },
        data: {
          status: BdmEarningStatus.PAID,
          paidAt: now,
        },
      });
      updatedCount = result.count;
    }
  }

  return NextResponse.json({ ok: true, updatedCount, month, action: payload.action });
}
