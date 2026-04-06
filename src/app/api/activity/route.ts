import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseActivityQuery, parseActivityTypesFilter } from "@/lib/api-query";
import { prismaKnownErrorResponse, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/activity-log";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ c: createdAt.toISOString(), i: id }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (
      typeof j === "object" &&
      j !== null &&
      "c" in j &&
      "i" in j &&
      typeof (j as { c: unknown }).c === "string" &&
      typeof (j as { i: unknown }).i === "string"
    ) {
      const createdAt = new Date((j as { c: string }).c);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id: (j as { i: string }).i };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const parsedQ = parseActivityQuery(request);
  if (!parsedQ.success) {
    return zodValidationErrorResponse(parsedQ.error);
  }

  const { limit, types: typesRaw, cursor: cursorRaw } = parsedQ.data;
  const types = parseActivityTypesFilter(typesRaw);
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;

  const companyId = session.companyId;

  const baseWhere: Prisma.ActivityLogWhereInput = { companyId };
  if (types?.length) {
    baseWhere.type = { in: types };
  }

  const where: Prisma.ActivityLogWhereInput =
    cursor !== null
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
                },
              ],
            },
          ],
        }
      : baseWhere;

  let rows;
  try {
    rows = await prisma.activityLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        type: true,
        message: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/activity", e);
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

  return NextResponse.json({
    ok: true as const,
    types: Object.values(ACTIVITY_TYPES) as ActivityType[],
    items: page.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      user: row.user,
    })),
    nextCursor,
  });
}
