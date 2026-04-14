import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logCaughtError, parseJsonBodyZod } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const STATUSES = new Set(["APPLICATION", "REVIEW", "TRAINING", "MOU", "APPROVED", "REJECTED"]);

const patchSchema = z.object({
  status: z.enum(["APPLICATION", "REVIEW", "TRAINING", "MOU", "APPROVED", "REJECTED"]).optional(),
  assignedToId: z.union([z.string().trim().min(1), z.null()]).optional(),
  note: z.string().trim().min(1).max(4000).optional(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;
    const parsed = await parseJsonBodyZod(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    const app = await prisma.microFranchiseApplication.findUnique({
      where: { id },
      select: { id: true, notes: true, status: true },
    });
    if (!app) {
      return NextResponse.json({ ok: false as const, error: "Not found", code: "NOT_FOUND" as const }, { status: 404 });
    }

    const notesArr = Array.isArray(app.notes) ? [...(app.notes as unknown[])] : [];
    if (parsed.data.note) {
      notesArr.push({
        at: new Date().toISOString(),
        body: parsed.data.note,
        authorEmail: session.email,
      });
    }

    const data: {
      status?: string;
      assignedToId?: string | null;
      notes?: object;
    } = {};
    if (parsed.data.status && STATUSES.has(parsed.data.status)) {
      data.status = parsed.data.status;
    }
    if (parsed.data.assignedToId !== undefined) {
      data.assignedToId = parsed.data.assignedToId;
    }
    if (parsed.data.note) {
      data.notes = notesArr;
    }

    const updated = await prisma.microFranchiseApplication.update({
      where: { id },
      data,
      include: {
        referredBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        partner: { select: { id: true } },
      },
    });

    return NextResponse.json({
      ok: true as const,
      application: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        location: updated.location,
        experience: updated.experience,
        status: updated.status,
        referredBy: updated.referredBy,
        assignedTo: updated.assignedTo,
        hasPartner: Boolean(updated.partner),
        createdAt: updated.createdAt.toISOString(),
        notes: updated.notes,
      },
    });
  } catch (e) {
    logCaughtError("PATCH /api/bgos/control/micro-franchise/applications/[id]", e);
    return NextResponse.json(
      { ok: false as const, error: "Update failed", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
