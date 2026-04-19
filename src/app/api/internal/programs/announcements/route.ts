import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NexaAnnouncementKind, NexaAnnouncementScope, UserRole } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { canManageCompanyPrograms } from "@/lib/nexa-ceo/company-boss";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(8000),
  kind: z.nativeEnum(NexaAnnouncementKind).optional(),
  scope: z.nativeEnum(NexaAnnouncementScope).default(NexaAnnouncementScope.ALL),
  target_roles: z.array(z.nativeEnum(UserRole)).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const can = await canManageCompanyPrograms(prisma, org.companyId, session.sub);
    if (!can) {
      return NextResponse.json(
        { ok: false as const, error: "Only org admins can broadcast.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;

    const row = await prisma.nexaAnnouncement.create({
      data: {
        companyId: org.companyId,
        title: parsed.data.title,
        message: parsed.data.message,
        kind: parsed.data.kind ?? NexaAnnouncementKind.GENERAL,
        scope: parsed.data.scope,
        targetRoles: parsed.data.target_roles ?? undefined,
        createdById: session.sub,
      },
    });

    return NextResponse.json({
      ok: true as const,
      announcement: {
        id: row.id,
        title: row.title,
        created_at: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    logCaughtError("POST /api/internal/programs/announcements", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to broadcast", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
