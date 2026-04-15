import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { startNexaOnboarding } from "@/lib/nexa-onboarding-start";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  companyName: z.string().trim().min(1),
  industry: z.enum(["SOLAR", "CUSTOM"]),
});

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
];

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const started = await startNexaOnboarding({
      userId: session.sub,
      source: "DIRECT",
    });
    const row = await prisma.onboardingSession.update({
      where: { id: started.sessionId },
      data: {
        companyName: parsed.data.companyName,
        industry: parsed.data.industry,
        currentStep: "industry",
        status: "draft",
      } as any,
    });
    return NextResponse.json({
      ok: true as const,
      sessionId: row.id,
      status: row.status,
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      {
        ok: false as const,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "SERVER_ERROR" as const,
      },
      { status: 500 },
    );
  }
}
