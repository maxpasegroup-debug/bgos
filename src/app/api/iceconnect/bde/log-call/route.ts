import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { logCallForToday } from "@/lib/bde-nexa-engine";

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  try {
    const m = await logCallForToday(session.sub);
    return NextResponse.json({
      ok: true as const,
      calls_logged: m.callsLogged,
    });
  } catch (e) {
    return handleApiError("POST /api/iceconnect/bde/log-call", e);
  }
}
