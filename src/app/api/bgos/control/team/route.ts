import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesNetworkRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { parseSalesNetworkRoleQuery } from "@/lib/internal-platform/get-internal-membership";
import { buildInternalTeamPayload } from "@/lib/internal-platform/internal-team-payload";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

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
    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const roleParam =
      parseSalesNetworkRoleQuery(searchParams.get("role")) ??
      parseSalesNetworkRoleQuery(searchParams.get("networkRole"));
    const networkRole =
      roleParam && Object.values(SalesNetworkRole).includes(roleParam) ? roleParam : undefined;
    const payload = await buildInternalTeamPayload(prisma, org.companyId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      networkRole,
    });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/team", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load team",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
