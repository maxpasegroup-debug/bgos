import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { assigneeFilter } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = requireIceconnectRole(request, [UserRole.INSTALLER]);
  if (session instanceof NextResponse) return session;

  const jobs = await prisma.installation.findMany({
    where: {
      companyId: session.companyId,
      ...assigneeFilter(session),
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    ok: true as const,
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      scheduledDate: j.scheduledDate?.toISOString() ?? null,
      notes: j.notes,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
      assignee: j.assignee,
    })),
  });
}
