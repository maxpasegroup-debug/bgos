import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  companyNameFromDescription,
  normalizeTechRequestStatus,
  parseTechRequestDescription,
  type DescriptionStatusEvent,
  type SdeTechRequestDescription,
} from "@/lib/sde-tech-request-payload";

const ALLOWED_ROLES = new Set(["TECH_EXECUTIVE", "TECH_HEAD", "ADMIN"]);

const patchSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  sdeNotes: z.string().optional(),
  estimatedDelivery: z.string().optional().nullable(),
  assignedSdeId: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const raw = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  const row = await prisma.techRequest.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const base = parseTechRequestDescription(row.description) as SdeTechRequestDescription;
  const history: DescriptionStatusEvent[] = Array.isArray(base.statusHistory) ? [...base.statusHistory] : [];
  const oldStatus = normalizeTechRequestStatus(row.status);
  const newStatus = body.status !== undefined ? body.status : oldStatus;
  const now = new Date().toISOString();

  if (body.status !== undefined && newStatus !== oldStatus) {
    history.push({ status: newStatus, at: now });
  }

  const next: SdeTechRequestDescription = {
    ...base,
    statusHistory: history,
  };

  if (body.sdeNotes !== undefined) next.sdeNotes = body.sdeNotes;
  if (body.estimatedDelivery !== undefined) next.estimatedDelivery = body.estimatedDelivery ?? undefined;
  if (body.assignedSdeId !== undefined) next.sdeAssigned = body.assignedSdeId ?? undefined;
  if (newStatus === "DONE" && !next.completedAt) next.completedAt = now;

  let descriptionString: string;
  try {
    descriptionString = JSON.stringify(next);
  } catch {
    return NextResponse.json({ error: "Could not serialize request notes" }, { status: 500 });
  }

  const updated = await prisma.techRequest.update({
    where: { id },
    data: {
      status: newStatus,
      description: descriptionString,
    },
    include: { company: { select: { id: true, name: true } } },
  });

  const becameDone = oldStatus !== "DONE" && newStatus === "DONE";
  if (becameDone && row.requestedBy && updated.companyId) {
    const afterDesc = parseTechRequestDescription(updated.description);
    const companyName = companyNameFromDescription(afterDesc, updated.company?.name ?? null);
    try {
      await prisma.internalInAppNotification.create({
        data: {
          userId: row.requestedBy,
          companyId: updated.companyId,
          type: "TECH_REQUEST_DONE",
          title: "Build Complete 🎉",
          body: `Dashboard ready: ${companyName}`,
        },
      });
    } catch (e) {
      console.error("[sde] BDM completion notification failed", e);
    }
  }

  const d = parseTechRequestDescription(updated.description);
  const reqUser = row.requestedBy
    ? await prisma.user.findUnique({
        where: { id: row.requestedBy },
        select: { id: true, name: true, email: true },
      })
    : null;

  return NextResponse.json({
    request: {
      id: updated.id,
      roleName: updated.roleName,
      status: normalizeTechRequestStatus(updated.status),
      priority: updated.priority,
      companyId: updated.companyId,
      requestedBy: updated.requestedBy,
      requestedByUser: reqUser,
      createdAt: updated.createdAt.toISOString(),
      description: d,
      companyName: companyNameFromDescription(d, updated.company?.name ?? null),
      industry: d.industry ?? null,
      employeeCount: typeof d.employeeCount === "number" ? d.employeeCount : 0,
      notes: d.notes ?? "",
      sdeNotes: d.sdeNotes ?? "",
      estimatedDelivery: d.estimatedDelivery ?? null,
      assignedSdeId: d.sdeAssigned ?? null,
      statusHistory: Array.isArray(d.statusHistory) ? d.statusHistory : [],
      type: d.type ?? null,
      completedAt: d.completedAt ?? null,
    },
  });
}
