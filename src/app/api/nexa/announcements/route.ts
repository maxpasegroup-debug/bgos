import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NexaAnnouncementKind, NexaAnnouncementScope, UserRole } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCompanyPrograms } from "@/lib/nexa-ceo/company-boss";
import { announcementVisibleForMember } from "@/lib/nexa-ceo/announcement-filter";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(8000),
  kind: z.nativeEnum(NexaAnnouncementKind).optional(),
  scope: z.nativeEnum(NexaAnnouncementScope).default(NexaAnnouncementScope.ALL),
  target_roles: z.array(z.nativeEnum(UserRole)).optional(),
  target_regions: z.array(z.string().trim().min(1)).optional(),
  expires_at: z.string().datetime().optional(),
});

/**
 * GET: announcements visible to the current member (broadcast rules).
 * POST: create announcement (company owner / admin).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const uc = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: session.sub, companyId } },
      select: { jobRole: true, region: true },
    });
    if (!uc) {
      return NextResponse.json(
        { ok: false as const, error: "Membership not found", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const rows = await prisma.nexaAnnouncement.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { createdBy: { select: { name: true } } },
    });

    const announcements = rows
      .filter((r) => announcementVisibleForMember(r, uc.jobRole, uc.region))
      .map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        kind: r.kind,
        created_at: r.createdAt.toISOString(),
        expires_at: r.expiresAt?.toISOString() ?? null,
        created_by_name: r.createdBy.name,
      }));

    return NextResponse.json({ ok: true as const, announcements });
  } catch (e) {
    logCaughtError("nexa-announcements-get", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load announcements", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const can = await canManageCompanyPrograms(prisma, companyId, session.sub);
    if (!can) {
      return NextResponse.json(
        { ok: false as const, error: "Only the company owner or admin can broadcast.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const b = parsed.data;

    const row = await prisma.nexaAnnouncement.create({
      data: {
        companyId,
        title: b.title,
        message: b.message,
        kind: b.kind ?? NexaAnnouncementKind.GENERAL,
        scope: b.scope,
        targetRoles: b.target_roles ?? undefined,
        targetRegions: b.target_regions ?? undefined,
        createdById: session.sub,
        expiresAt: b.expires_at ? new Date(b.expires_at) : null,
      },
    });

    return NextResponse.json({
      ok: true as const,
      announcement: { id: row.id, title: row.title, created_at: row.createdAt.toISOString() },
    });
  } catch (e) {
    logCaughtError("nexa-announcements-post", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to create announcement", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
