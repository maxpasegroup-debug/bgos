import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseIceconnectListQuery } from "@/lib/api-query";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
  zodValidationErrorResponse,
} from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.SERVICE]);
  if (session instanceof NextResponse) return session;

  const parsed = parseIceconnectListQuery(request, 100);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }
  const take = parsed.data.limit;

  const companyId = session.companyId;

  const where = isIceconnectPrivileged(session.role)
    ? { companyId }
    : {
        companyId,
        OR: [{ assignedTo: session.sub }, { assignedTo: null }],
      };

  let tickets;
  try {
    tickets = await prisma.serviceTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return internalServerErrorResponse();
  }

  return NextResponse.json({
    ok: true as const,
    tickets: tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      assignedTo: t.assignedTo,
      assignee: t.assignee,
    })),
  });
}
