import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  installationId: z.string().min(1),
  status: z.string().trim().min(1).max(120),
  notes: z.string().max(10000).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.INSTALLER]);
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

  const { installationId, status, notes } = parsed.data;

  const job = await prisma.installation.findFirst({
    where: { id: installationId, companyId: session.companyId },
  });

  if (!job) {
    return NextResponse.json(
      { ok: false as const, error: "Installation not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!isIceconnectPrivileged(session.role) && job.assignedTo !== session.sub) {
    return NextResponse.json(
      { ok: false as const, error: "Not assigned to you", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const isComplete = status.toLowerCase() === "completed";

  const updated = await prisma.installation.update({
    where: { id: installationId },
    data: {
      status,
      notes: notes !== undefined ? notes : job.notes,
      completedAt: isComplete ? new Date() : job.completedAt,
    },
  });

  return NextResponse.json({
    ok: true as const,
    job: {
      id: updated.id,
      status: updated.status,
      notes: updated.notes,
      completedAt: updated.completedAt?.toISOString() ?? null,
    },
  });
}
