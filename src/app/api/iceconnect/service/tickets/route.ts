import { ServiceTicketStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseIceconnectListQuery } from "@/lib/api-query";
import { prismaKnownErrorResponse, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";

function mapTicket(
  t: {
    id: string;
    title: string;
    description: string | null;
    status: ServiceTicketStatus;
    createdAt: Date;
    resolvedAt: Date | null;
    assignedTo: string | null;
    assignee: { id: string; name: string; email: string } | null;
  },
) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    assignedTo: t.assignedTo,
    assignee: t.assignee,
  };
}

const ticketInclude = {
  assignee: { select: { id: true, name: true, email: true } },
} as const;

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.SERVICE_TEAM]);
  if (session instanceof NextResponse) return session;

  const parsed = parseIceconnectListQuery(request, 100);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }
  const take = parsed.data.limit;

  const companyId = session.companyId;

  try {
    if (isIceconnectPrivileged(session.role)) {
      const tickets = await prisma.serviceTicket.findMany({
        where: { companyId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take,
        include: ticketInclude,
      });
      return NextResponse.json({
        ok: true as const,
        view: "supervisor" as const,
        tickets: tickets.map(mapTicket),
      });
    }

    const [myTickets, poolTickets] = await Promise.all([
      prisma.serviceTicket.findMany({
        where: {
          companyId,
          assignedTo: session.sub,
          status: ServiceTicketStatus.OPEN,
        },
        orderBy: { createdAt: "desc" },
        take,
        include: ticketInclude,
      }),
      prisma.serviceTicket.findMany({
        where: {
          companyId,
          assignedTo: null,
          status: ServiceTicketStatus.OPEN,
        },
        orderBy: { createdAt: "desc" },
        take,
        include: ticketInclude,
      }),
    ]);

    return NextResponse.json({
      ok: true as const,
      view: "field" as const,
      myTickets: myTickets.map(mapTicket),
      poolTickets: poolTickets.map(mapTicket),
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/iceconnect/service/tickets", e);
  }
}
