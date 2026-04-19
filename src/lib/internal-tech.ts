/**
 * Internal Tech Task Queue  (id: bgos_tech_system_v2)
 *
 * Manages the tech team's kanban queue with:
 *   · Priority tiers (LOW / MEDIUM / HIGH) → SLA deadlines
 *   · SLA timing: slaDeadlineAt = createdAt + SLA hours per priority
 *   · Response time: ms from creation to first "start" action
 *   · Completion time: ms from creation to "complete" action
 *   · Stats: pending count + avg completion time (last 30 days)
 *   · Round-robin auto-assign to TECH_EXEC with fewest open tasks
 */

import "server-only";

import {
  TechTaskStatus,
  TechTaskPriority,
  SalesNetworkRole,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

// ---------------------------------------------------------------------------
// SLA config
// ---------------------------------------------------------------------------

/** SLA response window in hours, per priority. */
export const SLA_HOURS: Record<TechTaskPriority, number> = {
  [TechTaskPriority.HIGH]:   4,
  [TechTaskPriority.MEDIUM]: 24,
  [TechTaskPriority.LOW]:    72,
};

function slaDeadlineFor(priority: TechTaskPriority, from: Date): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3_600_000);
}

// ---------------------------------------------------------------------------
// Public task shape (serialised for API responses)
// ---------------------------------------------------------------------------

export type TechTaskRow = {
  id: string;
  company: string;
  requestType: string;
  description: string | null;
  status: TechTaskStatus;
  priority: TechTaskPriority;
  assignedTo: string | null;
  assignedToName: string | null;
  slaDeadlineAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  responseTimeMs: number | null;
  completionTimeMs: number | null;
  createdAt: string;
  updatedAt: string;
};

function serialize(row: {
  id: string;
  company: string;
  requestType: string;
  description: string | null;
  status: TechTaskStatus;
  priority: TechTaskPriority;
  assignedTo: string | null;
  slaDeadlineAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  responseTimeMs: number | null;
  completionTimeMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  assigneeUser: { name: string | null } | null;
}): TechTaskRow {
  return {
    id: row.id,
    company: row.company,
    requestType: row.requestType,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assignedTo,
    assignedToName: row.assigneeUser?.name ?? null,
    slaDeadlineAt: row.slaDeadlineAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    responseTimeMs: row.responseTimeMs,
    completionTimeMs: row.completionTimeMs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const TASK_SELECT = {
  id: true,
  company: true,
  requestType: true,
  description: true,
  status: true,
  priority: true,
  assignedTo: true,
  slaDeadlineAt: true,
  startedAt: true,
  completedAt: true,
  responseTimeMs: true,
  completionTimeMs: true,
  createdAt: true,
  updatedAt: true,
  assigneeUser: { select: { name: true } },
} as const;

// ---------------------------------------------------------------------------
// Stats shape
// ---------------------------------------------------------------------------

export type TechStats = {
  pending: number;           // NEW + IN_PROGRESS
  avgCompletionMs: number | null;   // mean completionTimeMs over last 30 days
  avgCompletionHuman: string | null; // e.g. "3h 42m"
  slaBreached: number;       // open tasks past deadline
};

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

// ---------------------------------------------------------------------------
// Round-robin auto-assign
// ---------------------------------------------------------------------------

async function pickAssignee(
  companyId: string,
  prismaClient: PrismaClient,
): Promise<string | null> {
  const techExecs = await prismaClient.userCompany.findMany({
    where: {
      companyId,
      salesNetworkRole: SalesNetworkRole.TECH_EXEC,
      archivedAt: null,
    },
    select: { userId: true },
  });
  if (techExecs.length === 0) return null;

  // Count open tasks per exec
  const counts = await Promise.all(
    techExecs.map(async ({ userId }) => {
      const n = await prismaClient.internalTechTask.count({
        where: { assignedTo: userId, status: { not: TechTaskStatus.COMPLETED } },
      });
      return { userId, n };
    }),
  );

  counts.sort((a, b) => a.n - b.n);
  return counts[0]?.userId ?? null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createTechTask(
  prismaClient: PrismaClient = defaultPrisma,
  input: {
    company: string;
    requestType: string;
    description?: string;
    priority: TechTaskPriority;
    createdById: string;
  },
): Promise<TechTaskRow> {
  const orgResult = await getOrCreateInternalSalesCompanyId();
  if ("error" in orgResult) throw new Error("Internal org not found");
  const { companyId } = orgResult;

  const now = new Date();
  const slaDeadlineAt = slaDeadlineFor(input.priority, now);
  const assignedTo = await pickAssignee(companyId, prismaClient);

  const row = await prismaClient.internalTechTask.create({
    data: {
      companyId,
      company: input.company.trim(),
      requestType: input.requestType.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      slaDeadlineAt,
      assignedTo,
      createdById: input.createdById,
    },
    select: TASK_SELECT,
  });

  return serialize(row);
}

export async function listTechTasks(
  prismaClient: PrismaClient = defaultPrisma,
  filters: { assignedTo?: string; status?: TechTaskStatus } = {},
): Promise<TechTaskRow[]> {
  const orgResult = await getOrCreateInternalSalesCompanyId();
  if ("error" in orgResult) return [];
  const { companyId } = orgResult;

  const rows = await prismaClient.internalTechTask.findMany({
    where: {
      companyId,
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.status     ? { status: filters.status }         : {}),
    },
    select: TASK_SELECT,
    orderBy: [
      // HIGH first, then by SLA deadline ascending
      { priority: "desc" },
      { slaDeadlineAt: "asc" },
      { createdAt: "asc" },
    ],
  });

  return rows.map(serialize);
}

export async function updateTechTaskStatus(
  prismaClient: PrismaClient = defaultPrisma,
  id: string,
  newStatus: TechTaskStatus,
): Promise<TechTaskRow> {
  const existing = await prismaClient.internalTechTask.findUniqueOrThrow({
    where: { id },
    select: { status: true, createdAt: true, startedAt: true },
  });

  const now = new Date();
  const patch: Record<string, unknown> = { status: newStatus };

  if (newStatus === TechTaskStatus.IN_PROGRESS && !existing.startedAt) {
    patch.startedAt = now;
    patch.responseTimeMs = now.getTime() - existing.createdAt.getTime();
  }

  if (newStatus === TechTaskStatus.COMPLETED && !existing.startedAt) {
    // Edge case: completed without a start (direct jump)
    patch.startedAt = now;
    patch.responseTimeMs = now.getTime() - existing.createdAt.getTime();
    patch.completedAt = now;
    patch.completionTimeMs = now.getTime() - existing.createdAt.getTime();
  } else if (newStatus === TechTaskStatus.COMPLETED) {
    patch.completedAt = now;
    patch.completionTimeMs = now.getTime() - existing.createdAt.getTime();
  }

  const row = await prismaClient.internalTechTask.update({
    where: { id },
    data: patch,
    select: TASK_SELECT,
  });

  return serialize(row);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getTechStats(
  prismaClient: PrismaClient = defaultPrisma,
): Promise<TechStats> {
  const orgResult = await getOrCreateInternalSalesCompanyId();
  if ("error" in orgResult) return { pending: 0, avgCompletionMs: null, avgCompletionHuman: null, slaBreached: 0 };
  const { companyId } = orgResult;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [pending, completed, breached] = await Promise.all([
    // Pending = NEW + IN_PROGRESS
    prismaClient.internalTechTask.count({
      where: { companyId, status: { in: [TechTaskStatus.NEW, TechTaskStatus.IN_PROGRESS] } },
    }),
    // Completed in last 30 days — need completionTimeMs
    prismaClient.internalTechTask.findMany({
      where: {
        companyId,
        status: TechTaskStatus.COMPLETED,
        completedAt: { gte: thirtyDaysAgo },
        completionTimeMs: { not: null },
      },
      select: { completionTimeMs: true },
    }),
    // SLA breached: open tasks past slaDeadlineAt
    prismaClient.internalTechTask.count({
      where: {
        companyId,
        status: { in: [TechTaskStatus.NEW, TechTaskStatus.IN_PROGRESS] },
        slaDeadlineAt: { lt: now },
      },
    }),
  ]);

  const validMs = completed
    .map((r) => r.completionTimeMs)
    .filter((v): v is number => v !== null);

  const avgCompletionMs =
    validMs.length > 0
      ? Math.round(validMs.reduce((a, b) => a + b, 0) / validMs.length)
      : null;

  return {
    pending,
    avgCompletionMs,
    avgCompletionHuman: avgCompletionMs !== null ? formatDuration(avgCompletionMs) : null,
    slaBreached: breached,
  };
}
