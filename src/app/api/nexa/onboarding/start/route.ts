import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { startNexaOnboarding } from "@/lib/nexa-onboarding-start";

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MICRO_FRANCHISE,
];

const bodySchema = z.object({
  source: z.enum(["SALES", "FRANCHISE", "DIRECT"]),
  leadId: z.string().trim().optional(),
  partnerId: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, ALLOWED);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const started = await startNexaOnboarding({
      userId: session.sub,
      source: parsed.data.source,
      leadId: parsed.data.leadId ?? null,
      partnerId: parsed.data.partnerId ?? null,
    });
    const intro =
      parsed.data.source === "SALES"
        ? "Let's onboard this client."
        : parsed.data.source === "FRANCHISE"
          ? "Let's set up your business."
          : "Let's build your company.";

    return NextResponse.json({
      ok: true as const,
      success: true as const,
      user_id: session.sub,
      sessionId: started.sessionId,
      session_ready: true as const,
      resumed: started.resumed,
      intro,
    });
  } catch (error) {
    console.error("POST /api/nexa/onboarding/start", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: "Could not start onboarding",
        code: "SERVER_ERROR" as const,
        step_failed: "nexa_init" as const,
      },
      { status: 500 },
    );
  }
}
