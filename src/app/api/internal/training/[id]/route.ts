/**
 * DELETE /api/internal/training/[id]  — remove a training material (RSM / BOSS only)
 */

import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { prisma } from "@/lib/prisma";
import { canUpload, deleteTrainingMaterial, deleteTrainingFile } from "@/lib/internal-training";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    if (!canUpload(session.salesNetworkRole)) {
      return NextResponse.json(
        { ok: false as const, error: "Only RSM and BOSS can delete materials.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const { id } = await params;
    const deleted = await deleteTrainingMaterial(prisma, id, session.companyId);

    if (!deleted) {
      return NextResponse.json(
        { ok: false as const, error: "Material not found.", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }

    await deleteTrainingFile(deleted.fileUrl);

    return NextResponse.json({ ok: true as const, id });
  } catch (e) {
    logCaughtError("internal-training-delete", e);
    return NextResponse.json(
      { ok: false as const, error: "Delete failed", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
