import { LeadStatus, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { applyLeadStatusChange } from "@/lib/lead-status-service";

const bodySchema = z.object({
  leadId: z.string().min(1),
  status: z.nativeEnum(LeadStatus),
});

export async function PATCH(request: NextRequest) {
  const session = await requireIceconnectRole(request, [UserRole.TELECALLER]);
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

  const result = await applyLeadStatusChange({
    actorId: session.sub,
    companyId: session.companyId,
    leadId: parsed.data.leadId,
    nextStatus: parsed.data.status,
    requireAssigneeUserId: isIceconnectPrivileged(session.role) ? undefined : session.sub,
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ ok: true as const, lead: result.lead });
}
