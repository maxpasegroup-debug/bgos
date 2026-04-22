import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  companyNameFromDescription,
  normalizePriority,
  normalizeTechRequestStatus,
  parseTechRequestDescription,
} from "@/lib/sde-tech-request-payload";

const ALLOWED_ROLES = new Set(["TECH_EXECUTIVE", "TECH_HEAD", "ADMIN"]);

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.techRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, name: true } },
    },
  });

  const requesterIds = [...new Set(rows.map((r) => r.requestedBy).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const requests = rows.map((row) => {
    const desc = parseTechRequestDescription(row.description);
    const reqUser = row.requestedBy ? userById.get(row.requestedBy) : undefined;
    return {
      id: row.id,
      roleName: row.roleName,
      status: normalizeTechRequestStatus(row.status),
      priority: normalizePriority(row.priority),
      companyId: row.companyId,
      companyNameDb: row.company?.name ?? null,
      requestedBy: row.requestedBy,
      requestedByUser: reqUser ? { id: reqUser.id, name: reqUser.name, email: reqUser.email } : null,
      createdAt: row.createdAt.toISOString(),
      description: desc,
      companyName: companyNameFromDescription(desc, row.company?.name ?? null),
      industry: desc.industry ?? null,
      employeeCount: typeof desc.employeeCount === "number" ? desc.employeeCount : 0,
      notes: desc.notes ?? "",
      sdeNotes: desc.sdeNotes ?? "",
      estimatedDelivery: desc.estimatedDelivery ?? null,
      assignedSdeId: desc.sdeAssigned ?? null,
      statusHistory: Array.isArray(desc.statusHistory) ? desc.statusHistory : [],
      type: desc.type ?? null,
      completedAt: desc.completedAt ?? null,
    };
  });

  requests.sort((a, b) => {
    const pu = a.priority === "URGENT" ? 1 : 0;
    const pb = b.priority === "URGENT" ? 1 : 0;
    if (pu !== pb) return pb - pu;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json({ requests });
}
