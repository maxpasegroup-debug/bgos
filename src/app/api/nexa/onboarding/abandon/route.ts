import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  try {
    await prisma.onboardingSession.deleteMany({
      where: {
        createdByUserId: session.sub,
        status: { in: ["draft", "in_progress", "ready"] },
      },
    });
    return NextResponse.json({ ok: true as const, success: true as const });
  } catch (error) {
    console.error("POST /api/nexa/onboarding/abandon", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: "Could not reset onboarding session",
        step_failed: "nexa_init" as const,
      },
      { status: 500 },
    );
  }
}
