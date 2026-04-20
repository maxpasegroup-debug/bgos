import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperBossEmail } from "@/lib/super-boss";
import { canViewUserNexaPlan } from "@/lib/nexa-ceo/access";
import { buildDailyPlan, ensureDailyCoachingTouch } from "@/lib/nexa-ceo/daily-plan";

/**
 * Daily coaching plan for the active company. Query `user_id` to view a team member (boss / parent / admin).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const q = request.nextUrl.searchParams.get("user_id");
    const targetUserId = q && q.length > 0 ? q : session.sub;

    const allowed = await canViewUserNexaPlan(prisma, companyId, session.sub, targetUserId);
    if (!allowed) {
      return NextResponse.json(
        { ok: false as const, error: "Not allowed to view this user’s plan.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const platformBoss = isSuperBossEmail(session.email);

    const [planUser, m] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { name: true },
      }),
      prisma.userCompany.findUnique({
        where: { userId_companyId: { userId: targetUserId, companyId } },
        select: { salesNetworkRole: true, jobRole: true },
      }),
    ]);

    const firstName = planUser?.name?.trim().split(/\s+/)[0] ?? null;
    const plan = await buildDailyPlan(prisma, companyId, targetUserId, platformBoss, firstName);

    const roleLabel = m?.salesNetworkRole ?? m?.jobRole ?? "member";
    const summary = plan.nexa_messages[0]?.text ?? `${plan.tasks[0] ?? "Daily focus"} — ${plan.urgency_level}`;
    await ensureDailyCoachingTouch(prisma, companyId, targetUserId, String(roleLabel), summary);

    return NextResponse.json({
      ok: true as const,
      user_id: targetUserId,
      nexa_mode: plan.nexa_mode,
      tone_profile: plan.tone_profile,
      voice_version: plan.voice_version,
      nexa_messages: plan.nexa_messages,
      tasks: plan.tasks,
      insights: [...plan.insights, ...plan.promotion_nudges, ...plan.performance_triggers],
      urgency_level: plan.urgency_level,
      promotion_nudges: plan.promotion_nudges,
      performance_triggers: plan.performance_triggers,
      persuasion: plan.persuasion,
    });
  } catch (e) {
    logCaughtError("nexa-daily-plan", e);
    return NextResponse.json({
      ok: true as const,
      degraded: true as const,
      user_id: null,
      nexa_mode: "fallback",
      tone_profile: "steady",
      voice_version: "fallback",
      nexa_messages: [
        {
          kind: "fallback",
          text: "Nexa is syncing your data. Use the fallback game plan below.",
        },
      ],
      tasks: [
        "Review your top 5 active leads and update stage.",
        "Close pending follow-ups scheduled for today.",
        "Escalate blockers to your manager/tech queue.",
      ],
      insights: [
        "Keep pipeline hygiene tight while Nexa refreshes context.",
        "Prioritize tasks with customer deadlines first.",
      ],
      urgency_level: "normal",
      promotion_nudges: [],
      performance_triggers: [],
      persuasion: {
        smart_nudge: "Progress compounds. Finish one critical task now.",
      },
    });
  }
}
