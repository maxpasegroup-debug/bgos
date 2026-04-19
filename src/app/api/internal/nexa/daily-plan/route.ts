import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isSuperBossEmail } from "@/lib/super-boss";
import { buildDailyPlan, ensureDailyCoachingTouch } from "@/lib/nexa-ceo/daily-plan";

/**
 * Nexa coaching for the internal sales organisation (platform team).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }
    const companyId = org.companyId;
    const q = request.nextUrl.searchParams.get("user_id");
    const targetUserId = q && q.length > 0 ? q : session.sub;

    const member = await prisma.userCompany.findFirst({
      where: { companyId, userId: targetUserId },
      select: { userId: true },
    });
    if (!member) {
      return NextResponse.json(
        { ok: false as const, error: "User not in internal org", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }

    const planUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });
    const firstName = planUser?.name?.trim().split(/\s+/)[0] ?? null;
    const platformBoss = isSuperBossEmail(session.email);
    const plan = await buildDailyPlan(prisma, companyId, targetUserId, platformBoss, firstName);

    const m = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
      select: { salesNetworkRole: true, jobRole: true },
    });
    const roleLabel = m?.salesNetworkRole ?? m?.jobRole ?? "internal";
    const summary = plan.nexa_messages[0]?.text ?? `${plan.tasks[0] ?? "Daily focus"} — ${plan.urgency_level}`;
    await ensureDailyCoachingTouch(prisma, companyId, targetUserId, String(roleLabel), summary);

    return NextResponse.json({
      ok: true as const,
      user_id: targetUserId,
      tasks: plan.tasks,
      insights: [...plan.insights, ...plan.promotion_nudges, ...plan.performance_triggers],
      urgency_level: plan.urgency_level,
      persuasion: plan.persuasion,
      nexa_messages: plan.nexa_messages,
    });
  } catch (e) {
    console.error("GET /api/internal/nexa/daily-plan", e);
    logCaughtError("internal-nexa-daily-plan", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to build plan", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
