import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { activateMicroFranchiseFromApplication } from "@/lib/micro-franchise-activate";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

/**
 * Boss override: skip pipeline, set APPROVED, provision partner + wallet + ICECONNECT user.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const { id } = await ctx.params;

    const act = await activateMicroFranchiseFromApplication(id);
    if (!act.ok) {
      return NextResponse.json(
        { ok: false as const, error: act.error, code: "ACTIVATION_FAILED" as const },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true as const,
      partnerId: act.partnerId,
      userId: act.userId,
      temporaryPassword: act.plainPassword || undefined,
      loginEmail: act.loginEmail || undefined,
    });
  } catch (e) {
    logCaughtError("POST activate-mou", e);
    return NextResponse.json(
      { ok: false as const, error: "Activation error", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
