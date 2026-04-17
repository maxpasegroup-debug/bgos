import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { startNexaOnboarding } from "@/lib/nexa-onboarding-start";

const bodySchema = z.object({
  user_id: z.string().trim().min(1),
  email: z.string().trim().email(),
});

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MICRO_FRANCHISE,
];

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, ALLOWED);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.user_id !== session.sub || parsed.data.email.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json(
      { success: false as const, message: "Onboarding context mismatch" },
      { status: 403 },
    );
  }

  try {
    const started = await startNexaOnboarding({
      userId: session.sub,
      source: "DIRECT",
    });
    return NextResponse.json({
      success: true as const,
      data: {
        user_id: session.sub,
        email: session.email,
        session_id: started.sessionId,
      },
    });
  } catch (error) {
    console.error("POST /api/onboarding/init", error);
    return NextResponse.json(
      { success: false as const, message: "Could not initialize onboarding" },
      { status: 500 },
    );
  }
}
