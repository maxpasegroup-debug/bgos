import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPLICATION", "REVIEW", "TRAINING", "MOU", "APPROVED", "REJECTED"]).optional(),
  assignedToId: z.union([z.string().trim().min(1), z.null()]).optional(),
  note: z.string().trim().min(1).max(4000).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false as const, error: "Invalid payload" }, { status: 400 });
  }

  const app = await prisma.microFranchiseApplication.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, notes: true },
  });
  if (!app) return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });

  const notesArr = Array.isArray(app.notes) ? [...(app.notes as unknown[])] : [];
  if (parsed.data.note) {
    notesArr.push({
      at: new Date().toISOString(),
      body: parsed.data.note,
      authorEmail: session.email,
    });
  }

  const updated = await prisma.microFranchiseApplication.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.assignedToId !== undefined ? ({ assignedToId: parsed.data.assignedToId } as object) : {}),
      ...(parsed.data.note ? { notes: notesArr as object } : {}),
    } as object,
  });

  return NextResponse.json({
    ok: true as const,
    application: {
      id: updated.id,
      status: updated.status,
    },
  });
}
