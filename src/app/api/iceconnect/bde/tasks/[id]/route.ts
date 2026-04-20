import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { completeBdeTask } from "@/lib/bde-nexa-engine";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;

  try {
    const updated = await completeBdeTask(id, session.sub);
    if (!updated) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true as const,
      task: { id: updated.id, status: updated.status.toLowerCase() },
    });
  } catch (e) {
    return handleApiError("PATCH /api/iceconnect/bde/tasks/[id]", e);
  }
}
