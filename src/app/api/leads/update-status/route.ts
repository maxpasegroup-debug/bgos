import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { applyLeadPipelineUpdate } from "@/lib/lead-status-service";

const bodySchema = z
  .object({
    leadId: z.string().min(1),
    status: z.nativeEnum(LeadStatus).optional(),
    assignedToUserId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .refine((d) => d.status !== undefined || d.assignedToUserId !== undefined, {
    message: "Provide status and/or assignedToUserId",
  });

/**
 * Move lead in the pipeline and/or reassign. Logs LEAD_STATUS_CHANGED / LEAD_ASSIGNED.
 */
export async function PATCH(request: NextRequest) {
  const session = requireAuth(request);
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

  const result = await applyLeadPipelineUpdate({
    actorId: session.sub,
    companyId: session.companyId,
    leadId: parsed.data.leadId,
    nextStatus: parsed.data.status,
    assignedToUserId: parsed.data.assignedToUserId,
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ ok: true as const, lead: result.lead });
}
