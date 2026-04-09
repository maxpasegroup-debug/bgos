import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { isHrManagerRole } from "@/lib/hr";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  userId: z.string().cuid(),
  goal: z.string().trim().min(4).max(4000),
  dueDate: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().cuid(),
  progress: z.number().int().min(0).max(100).optional(),
  isCompleted: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) return jsonError(403, "FORBIDDEN", "Forbidden");

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = createSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const member = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: parsed.data.userId, companyId: session.companyId } },
    select: { userId: true },
  });
  if (!member) return jsonError(404, "NOT_FOUND", "Employee not found");

  const row = await (prisma as any).employeePip.create({
    data: {
      companyId: session.companyId,
      userId: parsed.data.userId,
      goal: parsed.data.goal,
      ...(parsed.data.dueDate ? { dueDate: new Date(parsed.data.dueDate) } : {}),
    },
  });
  return jsonSuccess({ id: row.id });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!isHrManagerRole(session.role)) return jsonError(403, "FORBIDDEN", "Forbidden");

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = updateSchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  if (parsed.data.progress === undefined && parsed.data.isCompleted === undefined) {
    return jsonError(400, "VALIDATION_ERROR", "Nothing to update");
  }

  const pip = await (prisma as any).employeePip.findFirst({
    where: { id: parsed.data.id, companyId: session.companyId },
    select: { id: true },
  });
  if (!pip) return jsonError(404, "NOT_FOUND", "PIP not found");

  await (prisma as any).employeePip.update({
    where: { id: pip.id },
    data: {
      ...(parsed.data.progress !== undefined ? { progress: parsed.data.progress } : {}),
      ...(parsed.data.isCompleted !== undefined ? { isCompleted: parsed.data.isCompleted } : {}),
    },
  });
  return jsonSuccess({ ok: true });
}
