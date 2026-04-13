import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { bossControlClientCategory, type BossControlClientCategory } from "@/lib/bgos-control-client-category";

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("category") as BossControlClientCategory | null;

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";

  const rows = await prisma.company.findMany({
    where: {
      internalSalesOrg: false,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    select: {
      id: true,
      name: true,
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

  return NextResponse.json({ ok: true as const, companies: filtered });
}
