import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IceconnectEmployeeRole, UsageFlagKind, UsageFlagStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireSalesChain } from "@/lib/onboarding-request-guards";
import {
  getCompanyIdsForBde,
  getCompanyIdsForBdm,
  getCompanyIdsForRsm,
} from "@/lib/sales-hierarchy";
import { prisma } from "@/lib/prisma";

function pct(kind: UsageFlagKind, row: {
  currentUsers: number;
  currentLeads: number;
  currentProjects: number;
}, limits: { maxUsers: number; maxLeads: number; maxProjects: number }): number {
  let cur = 0;
  let max = 1;
  switch (kind) {
    case UsageFlagKind.USERS:
      cur = row.currentUsers;
      max = limits.maxUsers;
      break;
    case UsageFlagKind.LEADS:
      cur = row.currentLeads;
      max = limits.maxLeads;
      break;
    case UsageFlagKind.PROJECTS:
      cur = row.currentProjects;
      max = limits.maxProjects;
      break;
    default:
      break;
  }
  if (max <= 0) return 0;
  return Math.min(100, Math.round((cur / max) * 1000) / 10);
}

async function scopeCompanyIds(
  userId: string,
  role: IceconnectEmployeeRole,
): Promise<string[]> {
  if (role === IceconnectEmployeeRole.BDE) return getCompanyIdsForBde(userId);
  if (role === IceconnectEmployeeRole.BDM) return getCompanyIdsForBdm(userId);
  return getCompanyIdsForRsm(userId);
}

/**
 * High-usage alerts for ICECONNECT sales (scoped by hierarchy).
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireSalesChain(session);
  if (gate instanceof NextResponse) return gate;

  const role = session.iceconnectEmployeeRole;
  if (!role) {
    return NextResponse.json({ ok: false as const, error: "Missing role" }, { status: 403 });
  }

  try {
    const scope = await scopeCompanyIds(session.sub, role);
    if (scope.length === 0) {
      return NextResponse.json({ ok: true as const, flags: [] as const });
    }

    const flags = await prisma.usageFlag.findMany({
      where: {
        companyId: { in: scope },
        status: {
          in: [
            UsageFlagStatus.ACTIVE,
            UsageFlagStatus.IN_PROGRESS,
            UsageFlagStatus.CONVERTED,
          ],
        },
      },
      include: {
        company: {
          select: {
            name: true,
            usageMetric: true,
            companyLimit: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const out = flags.map((f) => {
      const m = f.company.usageMetric;
      const l = f.company.companyLimit;
      const metricRow = m ?? {
        currentUsers: 0,
        currentLeads: 0,
        currentProjects: 0,
      };
      const limitRow = l ?? { maxUsers: 1, maxLeads: 1, maxProjects: 1 };
      return {
        id: f.id,
        company_id: f.companyId,
        company_name: f.company.name,
        kind: f.kind.toLowerCase(),
        usage_pct: pct(f.kind, metricRow, limitRow),
        status: f.status.toLowerCase(),
        action_status: f.actionStatus,
        handled_by: f.handledById,
        updated_at: f.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true as const, flags: out });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/usage/control", e);
  }
}
