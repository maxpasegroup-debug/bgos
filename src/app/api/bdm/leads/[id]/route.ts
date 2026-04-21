import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  nextAction: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(5000).optional(),
});
const NEXT_ACTION_PREFIX = "[NEXT_ACTION]";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Params) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) {
    return NextResponse.json({ error: "No active company in session." }, { status: 400 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = patchLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.lead.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, internalSalesNotes: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const payload = parsed.data;
  const existingLines = existing.internalSalesNotes ? existing.internalSalesNotes.split("\n") : [];
  const existingNonActionNotes = existingLines
    .filter((line) => !line.startsWith(NEXT_ACTION_PREFIX))
    .join("\n")
    .trim();
  const mergedNotes = payload.notes !== undefined ? payload.notes : existingNonActionNotes;
  const mergedNextAction = payload.nextAction !== undefined ? payload.nextAction : "";
  const composedInternalNotes = [
    ...(mergedNextAction ? [`${NEXT_ACTION_PREFIX} ${mergedNextAction}`] : []),
    ...(mergedNotes ? [mergedNotes] : []),
  ]
    .join("\n")
    .trim();

  const lead = await prisma.lead.update({
    where: { id: existing.id },
    data: {
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.notes !== undefined || payload.nextAction !== undefined
        ? { internalSalesNotes: composedInternalNotes || null }
        : {}),
      ...(payload.nextAction !== undefined || payload.status !== undefined || payload.notes !== undefined
        ? { lastActivityAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json({ lead });
}
