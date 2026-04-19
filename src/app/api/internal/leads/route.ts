import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { InternalSalesStage, InternalCallStatus, LeadStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import {
  requireInternalSalesSession,
  getScopedUserIds,
} from "@/lib/internal-sales-access";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["close", "follow_up"]),
});

/**
 * GET /api/internal/leads
 *
 * Returns paginated leads assigned to the caller's scoped user set.
 *
 * Query params:
 *   search  — filter by name / phone / company name (optional)
 *   take    — page size (default 20, max 50)
 *   skip    — offset    (default 0)
 *
 * Visibility mirrors getScopedUserIds:
 *   BDE   → own leads only
 *   BDM   → self + direct BDEs
 *   RSM   → self + BDMs + their BDEs
 *   BOSS  → full internal org
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  try {
    const sp = request.nextUrl.searchParams;
    const search = sp.get("search")?.trim() ?? "";
    const take = Math.min(50, Math.max(1, parseInt(sp.get("take") ?? "20", 10) || 20));
    const skip = Math.max(0, parseInt(sp.get("skip") ?? "0", 10) || 0);

    const scopedIds = await getScopedUserIds(
      session.companyId,
      session.userId,
      session.salesNetworkRole,
    );

    const where = {
      assignedTo: { in: scopedIds },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { leadCompanyName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        take,
        skip,
        orderBy: [
          { nextFollowUpAt: "asc" },
          { updatedAt: "desc" },
        ],
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          leadCompanyName: true,
          status: true,
          internalSalesStage: true,
          internalCallStatus: true,
          nextFollowUpAt: true,
          updatedAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      ok: true as const,
      total,
      take,
      skip,
      hasMore: skip + take < total,
      leads,
    });
  } catch (e) {
    return handleApiError("GET /api/internal/leads", e);
  }
}

/**
 * PATCH /api/internal/leads
 *
 * Applies a quick action on a single lead.
 *
 * Body: { id: string, action: "close" | "follow_up" }
 *
 * close      — sets internalSalesStage = CLOSED_LOST, status = LOST
 * follow_up  — sets internalSalesStage = FOLLOW_UP, internalCallStatus = INTERESTED,
 *              nextFollowUpAt = next day 10:00
 */
export async function PATCH(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Invalid request body.", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const { id, action } = parsed.data;

    const scopedIds = await getScopedUserIds(
      session.companyId,
      session.userId,
      session.salesNetworkRole,
    );

    const lead = await prisma.lead.findFirst({
      where: { id, assignedTo: { in: scopedIds } },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false as const, error: "Lead not found or not accessible.", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const updateData =
      action === "close"
        ? {
            internalSalesStage: InternalSalesStage.CLOSED_LOST,
            status: LeadStatus.LOST,
            internalStageUpdatedAt: new Date(),
          }
        : {
            internalSalesStage: InternalSalesStage.FOLLOW_UP,
            internalCallStatus: InternalCallStatus.INTERESTED,
            nextFollowUpAt: tomorrow,
            internalStageUpdatedAt: new Date(),
          };

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        internalSalesStage: true,
        status: true,
        internalCallStatus: true,
        nextFollowUpAt: true,
      },
    });

    return NextResponse.json({ ok: true as const, lead: updated });
  } catch (e) {
    return handleApiError("PATCH /api/internal/leads", e);
  }
}
