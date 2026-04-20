import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";

const bodySchema = z.object({
  stage: z.enum(["cold", "follow-up", "closing"]),
});

const SCRIPTS: Record<string, string> = {
  cold:
    "Hi, we help solar companies manage leads and installations easily. Can I show you a quick demo?",
  "follow-up":
    "Just checking in — this can help you track all your projects in one place.",
  closing: "We can set this up for you in minutes. Want to start a trial?",
};

/**
 * Short talk-track for BDE conversations by funnel stage.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const script = SCRIPTS[parsed.data.stage];
    return NextResponse.json({
      ok: true as const,
      stage: parsed.data.stage,
      script,
    });
  } catch (e) {
    return handleApiError("POST /api/nexa/sales-assist", e);
  }
}
