import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthUser, getTokenFromRequest, membershipCompanyIds } from "@/lib/auth";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { isSuperBossEmail } from "@/lib/super-boss";

export async function GET(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ ok: false as const, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      ok: true as const,
      clients: [] as { id: string; name: string; kind: "client" }[],
      employees: [] as { id: string; name: string; email: string; kind: "employee" }[],
      leads: [] as { id: string; title: string; kind: "lead" }[],
    });
  }

  let superBoss = false;
  const token = getTokenFromRequest(request);
  if (token) {
    const vr = verifyAccessTokenResult(token);
    const payload = vr.ok ? (vr.payload as Record<string, unknown>) : null;
    superBoss =
      payload?.superBoss === true && isSuperBossEmail(user.email) === true;
  }

  const companyIds = membershipCompanyIds(user);
  const activeCompanyId = user.companyId;

  const [clients, employees, leads] = await Promise.all([
    superBoss
      ? prisma.company.findMany({
          where: {
            internalSalesOrg: false,
            archivedAt: null,
            name: { contains: q, mode: "insensitive" },
          },
          take: 8,
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    activeCompanyId
      ? prisma.user.findMany({
          where: {
            isActive: true,
            memberships: { some: { companyId: activeCompanyId } },
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([] as { id: string; name: string; email: string }[]),
    activeCompanyId
      ? prisma.lead.findMany({
          where: {
            companyId: activeCompanyId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          select: { id: true, name: true },
        })
      : prisma.lead.findMany({
          where: {
            companyId: { in: companyIds.length ? companyIds : ["__none__"] },
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          select: { id: true, name: true },
        }),
  ]);

  return NextResponse.json({
    ok: true as const,
    clients: clients.map((c) => ({ id: c.id, name: c.name, kind: "client" as const })),
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      kind: "employee" as const,
    })),
    leads: leads.map((l) => ({ id: l.id, title: l.name, kind: "lead" as const })),
  });
}
