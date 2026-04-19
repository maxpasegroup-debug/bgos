import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { z } from "zod";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { applyLeadPipelineUpdate } from "@/lib/lead-status-service";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

const patchSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const { id: leadId } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Invalid JSON", code: "BAD_REQUEST" as const },
        { status: 400 },
      );
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false as const, error: "Validation failed", code: "VALIDATION" as const },
        { status: 400 },
      );
    }
    if (!parsed.data.status) {
      return NextResponse.json(
        { ok: false as const, error: "status is required", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const result = await applyLeadPipelineUpdate({
      actorId: session.sub,
      companyId: org.companyId,
      leadId,
      nextStatus: parsed.data.status,
    });

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
    return NextResponse.json({ ok: true as const, lead: result.lead });
  } catch (e) {
    logCaughtError("PATCH /api/internal/leads/[id]", e);
    return NextResponse.json(
      { ok: false as const, error: "Update failed", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
