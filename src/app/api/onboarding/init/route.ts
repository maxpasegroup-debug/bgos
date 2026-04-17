import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { forbidden, requireAuth } from "@/lib/auth";
import type { NexaOnboardingSource } from "@/lib/nexa-onboarding-engine";
import { prisma } from "@/lib/prisma";
import { startNexaOnboarding } from "@/lib/nexa-onboarding-start";

const bodySchema = z.object({
  user_id: z.string().trim().min(1),
  email: z.string().trim().email(),
  lead_id: z.string().trim().min(1).optional(),
  sales_owner_id: z.string().trim().min(1).optional(),
  franchise_id: z.string().trim().min(1).optional(),
  referral_source: z.string().trim().max(120).optional(),
});

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MICRO_FRANCHISE,
];

function resolveNexaSource(
  parsed: z.infer<typeof bodySchema>,
): { source: NexaOnboardingSource; franchisePartnerId: string | null } {
  if (parsed.franchise_id) {
    return { source: "FRANCHISE", franchisePartnerId: parsed.franchise_id };
  }
  if (parsed.lead_id || parsed.sales_owner_id) {
    return { source: "SALES", franchisePartnerId: null };
  }
  return { source: "DIRECT", franchisePartnerId: null };
}

export async function POST(request: NextRequest) {
  /** Pre-company users (first workspace) must be able to start Nexa — do not require an active company. */
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED.includes(session.role)) return forbidden();

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.user_id !== session.sub || parsed.data.email.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json(
      { success: false as const, message: "Onboarding context mismatch" },
      { status: 403 },
    );
  }

  const { source, franchisePartnerId } = resolveNexaSource(parsed.data);

  if (parsed.data.lead_id) {
    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.lead_id },
      select: { id: true, assignedTo: true },
    });
    if (!lead) {
      return NextResponse.json({ success: false as const, message: "Lead not found" }, { status: 400 });
    }
    if (
      parsed.data.sales_owner_id &&
      lead.assignedTo &&
      lead.assignedTo !== parsed.data.sales_owner_id
    ) {
      return NextResponse.json(
        { success: false as const, message: "Lead is not assigned to this sales owner" },
        { status: 403 },
      );
    }
  }

  try {
    const started = await startNexaOnboarding({
      userId: session.sub,
      source,
      leadId: parsed.data.lead_id ?? null,
      partnerId: franchisePartnerId,
      franchisePartnerId: franchisePartnerId ?? undefined,
      salesOwnerId: parsed.data.sales_owner_id ?? null,
      referralSource: parsed.data.referral_source ?? null,
    });

    const res = NextResponse.json({
      success: true as const,
      data: {
        user_id: session.sub,
        email: session.email,
        session_id: started.sessionId,
      },
    });

    res.cookies.set("bgos_onboarding_sid", started.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6,
    });

    return res;
  } catch (error) {
    console.error("POST /api/onboarding/init", error);
    return NextResponse.json(
      { success: false as const, message: "Could not initialize onboarding" },
      { status: 500 },
    );
  }
}
