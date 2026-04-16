import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { runNexaLeadAutoMovement } from "@/lib/nexa-lead-intelligence";
import { handleApiError } from "@/lib/route-error";

const bodySchema = z.object({
  previewOnly: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, [
    UserRole.SALES_EXECUTIVE,
    UserRole.TELECALLER,
    UserRole.MANAGER,
  ]);
  if (session instanceof NextResponse) return session;
  try {
    const out = await runNexaLeadAutoMovement({
      companyId: session.companyId,
      actorUserId: session.sub,
      previewOnly: true,
      onlyAssignedTo:
        session.role === UserRole.SALES_EXECUTIVE || session.role === UserRole.TELECALLER
          ? session.sub
          : undefined,
    });
    return NextResponse.json({ ok: true as const, ...out });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/sales/nexa-auto-move", e);
  }
}

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, [
    UserRole.SALES_EXECUTIVE,
    UserRole.TELECALLER,
    UserRole.MANAGER,
  ]);
  if (session instanceof NextResponse) return session;
  try {
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const out = await runNexaLeadAutoMovement({
      companyId: session.companyId,
      actorUserId: session.sub,
      previewOnly: parsed.data.previewOnly === true,
      onlyAssignedTo:
        session.role === UserRole.SALES_EXECUTIVE || session.role === UserRole.TELECALLER
          ? session.sub
          : undefined,
    });
    return NextResponse.json({ ok: true as const, ...out });
  } catch (e) {
    return handleApiError("POST /api/iceconnect/sales/nexa-auto-move", e);
  }
}
