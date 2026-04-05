import { ServiceTicketStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  ticketId: z.string().min(1),
});

export async function PATCH(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.SERVICE]);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const ticket = await prisma.serviceTicket.findFirst({
    where: {
      id: parsed.data.ticketId,
      companyId: session.companyId,
    },
  });

  if (!ticket) {
    return NextResponse.json(
      { ok: false as const, error: "Ticket not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (ticket.status === ServiceTicketStatus.RESOLVED) {
    return NextResponse.json({ ok: true as const, ticketId: ticket.id, alreadyResolved: true });
  }

  if (!isIceconnectPrivileged(session.role)) {
    const mine = ticket.assignedTo === session.sub;
    const unassigned = ticket.assignedTo === null;
    if (!mine && !unassigned) {
      return NextResponse.json(
        { ok: false as const, error: "Not assigned to you", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
  }

  const updated = await prisma.serviceTicket.update({
    where: { id: ticket.id },
    data: {
      status: ServiceTicketStatus.RESOLVED,
      resolvedAt: new Date(),
      assignedTo: ticket.assignedTo ?? session.sub,
    },
  });

  return NextResponse.json({
    ok: true as const,
    ticket: {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    },
  });
}
