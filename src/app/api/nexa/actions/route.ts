import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";

export async function GET(request: Request) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  try {
    const rows = await prisma.nexaAction.findMany({
      where: { companyId: session.companyId },
      orderBy: { executedAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        event: true,
        target: true,
        status: true,
        message: true,
        executedAt: true,
      },
    });
    return jsonSuccess({
      actions: rows.map((r) => ({
        ...r,
        executedAt: r.executedAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/nexa/actions", e);
  }
}
