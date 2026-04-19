import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NexaWelfareType } from "@prisma/client";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCompanyPrograms } from "@/lib/nexa-ceo/company-boss";

const createSchema = z.object({
  user_id: z.string().min(1),
  type: z.nativeEnum(NexaWelfareType),
  message: z.string().trim().min(1).max(4000),
});

/**
 * GET: recent welfare / recognition rows for the signed-in user.
 * POST: boss/admin recognition or bonus note for a team member.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const rows = await prisma.nexaEmployeeWelfare.findMany({
      where: { companyId, userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return NextResponse.json({
      ok: true as const,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        message: r.message,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    logCaughtError("nexa-welfare-get", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load welfare", code: "INTERNAL" as const },
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
        { ok: false as const, error: "Only owner or admin can post welfare notes.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodyZod(request, createSchema);
    if (!parsed.ok) return parsed.response;

    const target = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: parsed.data.user_id, companyId } },
      select: { userId: true },
    });
    if (!target) {
      return NextResponse.json(
        { ok: false as const, error: "User is not in this company.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const row = await prisma.nexaEmployeeWelfare.create({
      data: {
        companyId,
        userId: parsed.data.user_id,
        type: parsed.data.type,
        message: parsed.data.message,
      },
    });

    return NextResponse.json({
      ok: true as const,
      id: row.id,
      created_at: row.createdAt.toISOString(),
    });
  } catch (e) {
    logCaughtError("nexa-welfare-post", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to create welfare entry", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
