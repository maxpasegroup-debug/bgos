import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  IceconnectEmployeeRole,
  OnboardingRequestStatus,
  UserMissionStatus,
} from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectWorkforce } from "@/lib/onboarding-request-guards";
import { getBdeIdsUnderRsm } from "@/lib/sales-hierarchy";
import { getBdeOnboardingSnapshotForUser } from "@/lib/bde-onboarding-engine";
import { prisma } from "@/lib/prisma";
import { utcTodayDate } from "@/lib/bde-nexa-engine";

/**
 * Sales leadership: BDE performance, daily activity, conversion snapshot.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const w = requireIceconnectWorkforce(session);
  if (w instanceof NextResponse) return w;

  const role = session.iceconnectEmployeeRole;
  if (role !== IceconnectEmployeeRole.RSM && role !== IceconnectEmployeeRole.BDM) {
    return NextResponse.json({ ok: false as const, error: "RSM or BDM only" }, { status: 403 });
  }

  try {
    let bdeIds: string[] = [];
    if (role === IceconnectEmployeeRole.RSM) {
      bdeIds = await getBdeIdsUnderRsm(session.sub);
    } else {
      const bdes = await prisma.user.findMany({
        where: {
          parentId: session.sub,
          iceconnectEmployeeRole: IceconnectEmployeeRole.BDE,
        },
        select: { id: true },
      });
      bdeIds = bdes.map((b) => b.id);
    }

    if (bdeIds.length === 0) {
      return NextResponse.json({
        ok: true as const,
        bdes: [],
        totals: {
          prospects_7d: 0,
          missions_completed_today: 0,
          trials_started_30d: 0,
          conversion_rate: 0,
        },
      });
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const since30 = new Date();
    since30.setUTCDate(since30.getUTCDate() - 30);
    const today = utcTodayDate();

    const [prospects7d, missionsToday, converted, trials30d] = await Promise.all([
      prisma.bdeProspect.count({
        where: { userId: { in: bdeIds }, createdAt: { gte: since } },
      }),
      prisma.userMission.count({
        where: {
          userId: { in: bdeIds },
          missionDate: today,
          status: UserMissionStatus.COMPLETED,
        },
      }),
      prisma.bdeProspect.count({
        where: { userId: { in: bdeIds }, pipelineStage: "CONVERTED" },
      }),
      prisma.onboardingRequest.count({
        where: {
          createdByUserId: { in: bdeIds },
          status: OnboardingRequestStatus.COMPLETED,
          updatedAt: { gte: since30 },
        },
      }),
    ]);

    const totalProspects = await prisma.bdeProspect.count({
      where: { userId: { in: bdeIds } },
    });
    const conversion_rate =
      totalProspects === 0 ? 0 : Math.round((converted / totalProspects) * 1000) / 10;

    const perBde = await Promise.all(
      bdeIds.map(async (id) => {
        const u = await prisma.user.findUnique({
          where: { id },
          select: { name: true, email: true },
        });
        const [p7, umToday, trials] = await Promise.all([
          prisma.bdeProspect.count({
            where: { userId: id, createdAt: { gte: since } },
          }),
          prisma.userMission.findUnique({
            where: { userId_missionDate: { userId: id, missionDate: today } },
            select: { callsLogged: true, completedCount: true, targetCount: true, status: true, type: true },
          }),
          prisma.onboardingRequest.count({
            where: {
              createdByUserId: id,
              status: OnboardingRequestStatus.COMPLETED,
              updatedAt: { gte: since30 },
            },
          }),
        ]);
        const onboarding = await getBdeOnboardingSnapshotForUser(id);
        return {
          user_id: id,
          name: u?.name ?? "BDE",
          email: u?.email ?? "",
          prospects_7d: p7,
          calls_logged_today: umToday?.callsLogged ?? 0,
          trials_30d: trials,
          onboarding: {
            current_day: onboarding.current_day,
            completed: onboarding.completed,
            progress_pct: onboarding.progress_pct,
            started_at: onboarding.started_at,
          },
          mission_today: umToday
            ? {
                kind: umToday.type.toLowerCase(),
                status: umToday.status.toLowerCase(),
                completed_count: umToday.completedCount,
                target_count: umToday.targetCount,
              }
            : null,
        };
      }),
    );

    return NextResponse.json({
      ok: true as const,
      bdes: perBde,
      totals: {
        prospects_7d: prospects7d,
        missions_completed_today: missionsToday,
        trials_started_30d: trials30d,
        conversion_rate,
      },
    });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/sales/report", e);
  }
}
