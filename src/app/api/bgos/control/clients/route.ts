import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { bossControlClientCategory, type BossControlClientCategory } from "@/lib/bgos-control-client-category";

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("category") as BossControlClientCategory | null;

    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";
    const cacheKey = `control:clients:includeArchived=${includeArchived}:filter=${filter ?? "all"}`;
    const cached = getApiCache<{ companies: unknown[] }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true as const, companies: cached.companies });
    }

    const rows = await prisma.company.findMany({
    where: {
      internalSalesOrg: false,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    select: {
      id: true,
      name: true,
      industry: true,
      plan: true,
      subscriptionStatus: true,
      isTrialActive: true,
      internalSalesOrg: true,
      owner: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const companies = rows
    .map((c) => {
      const category = bossControlClientCategory(c);
      if (category == null) return null;
      return {
        companyId: c.id,
        name: c.name,
        industry: c.industry,
        status: c.subscriptionStatus === "ACTIVE" || c.isTrialActive ? "ACTIVE" : "INACTIVE",
        category,
        plan: c.plan,
        subscriptionStatus: c.subscriptionStatus,
        bossName: c.owner?.name?.trim() || "—",
      };
    })
    .filter(Boolean) as {
    companyId: string;
    name: string;
    category: BossControlClientCategory;
    plan: string;
    subscriptionStatus: string;
    bossName: string;
  }[];

    const filtered =
      filter && ["TRIAL", "BASIC", "PRO", "ENTERPRISE", "LOST"].includes(filter)
        ? companies.filter((x) => x.category === filter)
        : companies;

    setApiCache(cacheKey, { companies: filtered });
    return NextResponse.json({ ok: true as const, companies: filtered });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/clients", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load clients",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
