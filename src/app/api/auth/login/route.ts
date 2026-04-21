import bcrypt from "bcrypt";
import { CompanyPlan, EmployeeDomain, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";
import { ACTIVE_COMPANY_COOKIE_NAME } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { isSuperBossEmail } from "@/lib/super-boss";

type MembershipWithCompany = {
  companyId: string;
  jobRole: UserRole;
  status: string;
  archivedAt: Date | null;
  createdAt: Date;
  company: {
    workspaceDomain: EmployeeDomain;
    plan: CompanyPlan;
    trialEndDate: Date | null;
    subscriptionPeriodEnd: Date | null;
    subscriptionStatus: string;
  };
};

function rolePriority(role: UserRole): number {
  if (role === UserRole.ADMIN) return 100;
  if (role === UserRole.MANAGER) return 80;
  if (role === UserRole.SALES_HEAD) return 70;
  return 10;
}

function selectPrimaryMembership(
  memberships: MembershipWithCompany[],
  preferredCompanyId: string | undefined,
): MembershipWithCompany | null {
  if (!memberships || memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];

  const active = memberships.filter((m) => m.archivedAt === null);
  const base = active.length > 0 ? active : memberships;

  if (preferredCompanyId && preferredCompanyId.trim()) {
    const byCookie = base.find((m) => m.companyId === preferredCompanyId);
    if (byCookie) return byCookie;
  }

  const readyByStatus = base.filter((m) => m.status.toUpperCase() === "READY");
  const pool = readyByStatus.length > 0 ? readyByStatus : base;

  return [...pool].sort((a, b) => {
    const roleDelta = rolePriority(b.jobRole) - rolePriority(a.jobRole);
    if (roleDelta !== 0) return roleDelta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  })[0];
}

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    include: {
      memberships: {
        include: {
          company: {
            select: {
              workspaceDomain: true,
              plan: true,
              trialEndDate: true,
              subscriptionPeriodEnd: true,
              subscriptionStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid" }, { status: 401 });
  }

  let valid = false;

  if (user.password.startsWith("$2")) {
    valid = await bcrypt.compare(password, user.password);
  } else {
    valid = password === user.password;
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid" }, { status: 401 });
  }

  const jar = await cookies();
  const activeCompanyIdCookie = jar.get(ACTIVE_COMPANY_COOKIE_NAME)?.value;
  const primaryMembership = selectPrimaryMembership(
    user.memberships as MembershipWithCompany[],
    activeCompanyIdCookie,
  );
  const companyId = primaryMembership?.companyId ?? null;
  const companyPlan = primaryMembership?.company.plan ?? CompanyPlan.BASIC;
  const role = primaryMembership?.jobRole ?? UserRole.TELECALLER;
  const workspaceReady = primaryMembership ? Boolean(user.workspaceActivatedAt) : false;

  if (!primaryMembership) {
    console.warn(`[bgos] login: user ${user.id} has no memberships`);
  }

  const memberships =
    user.memberships.length > 0
      ? user.memberships.map((m) => ({
          companyId: m.companyId,
          plan: m.company.plan,
          jobRole: m.jobRole,
          trialEndsAt: m.company.trialEndDate?.toISOString() ?? null,
          subscriptionPeriodEnd: m.company.subscriptionPeriodEnd?.toISOString() ?? null,
          subscriptionStatus: m.company.subscriptionStatus,
        }))
      : undefined;

  const employeeDomain =
    primaryMembership?.company.workspaceDomain === EmployeeDomain.SOLAR
      ? "SOLAR"
      : primaryMembership
        ? "BGOS"
        : user.employeeDomain === EmployeeDomain.SOLAR
          ? "SOLAR"
          : "BGOS";

  const token = signToken({
    sub: user.id,
    email: user.email,
    role,
    companyId,
    companyPlan,
    workspaceReady,
    jwtVersion: 2,
    ...(memberships ? { memberships } : {}),
    employeeDomain,
    ...(isSuperBossEmail(user.email) ? { superBoss: true } : {}),
  });

  const res = NextResponse.json({ success: true });

  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
