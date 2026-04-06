import { LeadStatus, TaskStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ACTIVITY_TYPES } from "@/lib/activity-log";

const ACTIVITY_TYPE_SET = new Set<string>(Object.values(ACTIVITY_TYPES));

export function searchParamsRecord(searchParams: URLSearchParams): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}

const emptyToUndef = (v: unknown) => (v === "" || v === undefined ? undefined : v);

export const tasksListQuerySchema = z
  .object({
    status: z.preprocess(emptyToUndef, z.nativeEnum(TaskStatus).optional()),
    leadId: z.preprocess(emptyToUndef, z.string().min(1).max(128).optional()),
    assignedTo: z.preprocess(emptyToUndef, z.string().min(1).max(128).optional()),
    overdue: z.preprocess(emptyToUndef, z.enum(["1", "true", "0", "false"]).optional()),
    /** `priority` (default): higher priority first, then due date. `due`: due date ascending. `created`: newest first. */
    sort: z.preprocess(emptyToUndef, z.enum(["priority", "due", "created"]).optional()),
    limit: z.coerce.number().int().min(1).max(100).catch(50),
    offset: z.coerce.number().int().min(0).max(500_000).catch(0),
  })
  .superRefine((data, ctx) => {
    const overdueOnly = data.overdue === "1" || data.overdue === "true";
    if (overdueOnly && data.status !== undefined && data.status !== TaskStatus.PENDING) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Query overdue=true only applies with pending tasks",
        path: ["overdue"],
      });
    }
  });

export const leadsListQuerySchema = z.object({
  status: z.preprocess(emptyToUndef, z.nativeEnum(LeadStatus).optional()),
  assignedTo: z.preprocess(emptyToUndef, z.string().min(1).max(128).optional()),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
  offset: z.coerce.number().int().min(0).max(500_000).catch(0),
});

export const activityListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).catch(50),
  types: z.preprocess(emptyToUndef, z.string().max(500).optional()),
  cursor: z.preprocess(emptyToUndef, z.string().max(4096).optional()),
});

export function parseActivityTypesFilter(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = parts.filter((t) => ACTIVITY_TYPE_SET.has(t));
  return allowed.length ? allowed : undefined;
}

export function iceconnectListQuerySchema(defaultLimit: number) {
  return z.object({
    limit: z.coerce.number().int().min(1).max(200).catch(defaultLimit),
  });
}

export function parseTasksQuery(request: NextRequest) {
  return tasksListQuerySchema.safeParse(searchParamsRecord(request.nextUrl.searchParams));
}

export function parseLeadsQuery(request: NextRequest) {
  return leadsListQuerySchema.safeParse(searchParamsRecord(request.nextUrl.searchParams));
}

export function parseActivityQuery(request: NextRequest) {
  return activityListQuerySchema.safeParse(searchParamsRecord(request.nextUrl.searchParams));
}

export function parseIceconnectListQuery(request: NextRequest, defaultLimit: number) {
  return iceconnectListQuerySchema(defaultLimit).safeParse(
    searchParamsRecord(request.nextUrl.searchParams),
  );
}
