import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { startNexaOnboarding } from "@/lib/nexa-onboarding-start";

const bodySchema = z.object({
  user_id: z.string().trim().min(1),
  email: z.string().trim().email(),
  lead_id: z.string().trim().min(1).optional(),
  sales_owner_id: z.string().trim().min(1).optional(),
  franchise_id: z.string().trim().min(1).optional(),
  referral_source: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.user_id !== auth.sub) {
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        message: "user_id must match the signed-in user",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  if (parsed.data.email.trim().toLowerCase() !== auth.email.trim().toLowerCase()) {
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        message: "email must match the signed-in user",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  try {
    const started = await startNexaOnboarding({
      userId: auth.sub,
      source: parsed.data.sales_owner_id
        ? "SALES"
        : parsed.data.franchise_id
          ? "FRANCHISE"
          : "DIRECT",
      leadId: parsed.data.lead_id ?? null,
      salesOwnerId: parsed.data.sales_owner_id ?? null,
      franchisePartnerId: parsed.data.franchise_id ?? null,
      referralSource: parsed.data.referral_source ?? null,
    });

    return NextResponse.json({
      ok: true as const,
      success: true as const,
      data: {
        session_id: started.sessionId,
        user_id: auth.sub,
        resumed: started.resumed,
      },
    });
  } catch (error) {
    console.error("POST /api/onboarding/init", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        message: "Could not initialize onboarding",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
