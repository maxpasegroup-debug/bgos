import {
  CompanyPlan,
  CompanySubscriptionStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { deleteApiCacheByPrefix, getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { bossControlClientCategory } from "@/lib/bgos-control-client-category";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { companyMembershipClass } from "@/lib/user-company";

const SALES_ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.SALES_HEAD,
  UserRole.TELECALLER,
  UserRole.MANAGER,
];

const ASSIGNEE_POOL_ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.SALES_HEAD,
  UserRole.MANAGER,
];

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    companyEmail: z.union([z.string().email(), z.literal("")]).optional(),
    companyPhone: z.union([z.string().trim().max(64), z.literal("")]).optional(),
    billingAddress: z.union([z.string().max(8000), z.literal("")]).optional(),
    plan: z.nativeEnum(CompanyPlan).optional(),
    subscriptionStatus: z.nativeEnum(CompanySubscriptionStatus).optional(),
    assignedSalesExecutiveUserId: z.union([z.string().min(1), z.null()]).optional(),
    archive: z.boolean().optional(),
    markInactive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field" });

type Ctx = { params: Promise<{ companyId: string }> };

function invalidateControlCaches(companyId: string): void {
  deleteApiCacheByPrefix("control:clients:");
  deleteApiCacheByPrefix("control:summary");
  deleteApiCacheByPrefix("control:sales-overview");
  deleteApiCacheByPrefix("control:tech-queue");
  deleteApiCacheByPrefix("control:vision");
  deleteApiCacheByPrefix("control:accounts-overview");
  deleteApiCacheByPrefix("control:team:");
  deleteApiCacheByPrefix(`control:client:${companyId}`);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = requireInternalPlatformApi(request);
  if (session instanceof NextResponse) return session;
  const { companyId } = await ctx.params;
  const cacheKey = `control:client:${companyId}`;
  const cached = getApiCache<Record<string, unknown>>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, internalSalesOrg: false },
    select: {
      id: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      isTrialActive: true,
      internalSalesOrg: true,
      trialEndDate: true,
      subscriptionPeriodEnd: true,
      createdAt: true,
      archivedAt: true,
      companyEmail: true,
      companyPhone: true,
      billingAddress: true,
      customOnboardingSubmittedAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          workspaceActivatedAt: true,
        },
      },
    },
  });

  if (!company) {
    return NextResponse.json(
      { ok: false as const, error: "Company not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  const category = bossControlClientCategory(company);
  const [billing, salesMemberships, activities, assignRows] = await Promise.all([
    prisma.razorpayPayment.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        plan: true,
        createdAt: true,
      },
    }),
    prisma.userCompany.findMany({
      where: { companyId, jobRole: { in: SALES_ROLES } },
      take: 8,
      select: {
        userId: true,
        jobRole: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.activityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        type: true,
        message: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.userCompany.findMany({
      where: {
        company: { internalSalesOrg: true },
        jobRole: { in: ASSIGNEE_POOL_ROLES },
        user: { isActive: true },
      },
      select: {
        userId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const seen = new Set<string>();
  const assignableSalesExecutives = assignRows
    .filter((r) => {
      if (seen.has(r.userId)) return false;
      seen.add(r.userId);
      return true;
    })
    .map((r) => r.user)
    .sort((a, b) => a.name.localeCompare(b.name));

  const salesExecutive =
    salesMemberships.find((m) => m.jobRole === UserRole.SALES_EXECUTIVE) ??
    salesMemberships[0] ??
    null;

  const milestones: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actorName: string | null;
  }[] = [
    {
      id: "milestone-created",
      type: "TIMELINE",
      message: "Company created",
      createdAt: company.createdAt.toISOString(),
      actorName: company.owner?.name ?? null,
    },
  ];
  if (company.customOnboardingSubmittedAt) {
    milestones.push({
      id: "milestone-onboarding-form",
      type: "TIMELINE",
      message: "Custom onboarding requirements submitted",
      createdAt: company.customOnboardingSubmittedAt.toISOString(),
      actorName: null,
    });
  }
  if (company.owner?.workspaceActivatedAt) {
    milestones.push({
      id: "milestone-workspace",
      type: "TIMELINE",
      message: "Boss workspace activated (onboarding)",
      createdAt: company.owner.workspaceActivatedAt.toISOString(),
      actorName: company.owner.name,
    });
  }

  const activityTimeline = [
    ...milestones,
    ...activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      actorName: a.user?.name ?? a.user?.email ?? null,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const payload = {
    ok: true as const,
    company: {
      id: company.id,
      name: company.name,
      plan: company.plan,
      subscriptionStatus: company.subscriptionStatus,
      isTrialActive: company.isTrialActive,
      category: category ?? "BASIC",
      trialEndDate: company.trialEndDate?.toISOString() ?? null,
      subscriptionPeriodEnd: company.subscriptionPeriodEnd?.toISOString() ?? null,
      createdAt: company.createdAt.toISOString(),
      archivedAt: company.archivedAt?.toISOString() ?? null,
      companyEmail: company.companyEmail ?? "",
      companyPhone: company.companyPhone ?? "",
      billingAddress: company.billingAddress ?? "",
    },
    boss: company.owner
      ? {
          id: company.owner.id,
          name: company.owner.name,
          email: company.owner.email,
          mobile: company.owner.mobile,
          workspaceActivatedAt: company.owner.workspaceActivatedAt?.toISOString() ?? null,
        }
      : null,
    billingHistory: billing.map((b) => ({
      id: b.id,
      amount: b.amount,
      currency: b.currency,
      status: b.status,
      plan: b.plan,
      createdAt: b.createdAt.toISOString(),
    })),
    assignedSalesExecutive: salesExecutive
      ? {
          userId: salesExecutive.user.id,
          name: salesExecutive.user.name,
          email: salesExecutive.user.email,
          jobRole: salesExecutive.jobRole,
        }
      : null,
    assignableSalesExecutives,
    activityTimeline,
  };
  setApiCache(cacheKey, payload);
  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = requireInternalPlatformApi(request);
  if (session instanceof NextResponse) return session;
  const { companyId } = await ctx.params;

  const existing = await prisma.company.findFirst({
    where: { id: companyId, internalSalesOrg: false },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "Company not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" as const },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: parsed.error.flatten(), code: "VALIDATION_ERROR" as const },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const coUpdate: Prisma.CompanyUpdateInput = {};

  if (data.name !== undefined) coUpdate.name = data.name;
  if (data.companyEmail !== undefined) coUpdate.companyEmail = data.companyEmail || null;
  if (data.companyPhone !== undefined) coUpdate.companyPhone = data.companyPhone || null;
  if (data.billingAddress !== undefined) coUpdate.billingAddress = data.billingAddress || null;
  if (data.plan !== undefined) coUpdate.plan = data.plan;
  if (data.subscriptionStatus !== undefined) coUpdate.subscriptionStatus = data.subscriptionStatus;
  if (data.archive === true) coUpdate.archivedAt = new Date();
  if (data.archive === false) coUpdate.archivedAt = null;
  if (data.markInactive === true) {
    coUpdate.subscriptionStatus = CompanySubscriptionStatus.EXPIRED;
    coUpdate.isTrialActive = false;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(coUpdate).length > 0) {
        await tx.company.update({
          where: { id: companyId },
          data: coUpdate,
        });
      }

      if (data.assignedSalesExecutiveUserId !== undefined) {
        const poolLinks = await tx.userCompany.findMany({
          where: {
            company: { internalSalesOrg: true },
            jobRole: { in: ASSIGNEE_POOL_ROLES },
            user: { isActive: true },
          },
          select: { userId: true },
        });
        const poolUserIds = [...new Set(poolLinks.map((p) => p.userId))];

        if (data.assignedSalesExecutiveUserId === null) {
          await tx.userCompany.deleteMany({
            where: {
              companyId,
              jobRole: UserRole.SALES_EXECUTIVE,
              userId: { in: poolUserIds },
            },
          });
        } else {
          const uid = data.assignedSalesExecutiveUserId;
          const u = await tx.user.findFirst({
            where: { id: uid, isActive: true },
            select: { id: true },
          });
          if (!u) {
            throw new Error("ASSIGNEE_NOT_FOUND");
          }
          const inPool = await tx.userCompany.findFirst({
            where: {
              userId: uid,
              company: { internalSalesOrg: true },
              jobRole: { in: ASSIGNEE_POOL_ROLES },
            },
            select: { id: true },
          });
          if (!inPool) {
            throw new Error("ASSIGNEE_NOT_ELIGIBLE");
          }
          await tx.userCompany.deleteMany({
            where: {
              companyId,
              jobRole: UserRole.SALES_EXECUTIVE,
              userId: { in: poolUserIds },
            },
          });
          await tx.userCompany.upsert({
            where: { userId_companyId: { userId: uid, companyId } },
            create: {
              userId: uid,
              companyId,
              role: companyMembershipClass(UserRole.SALES_EXECUTIVE),
              jobRole: UserRole.SALES_EXECUTIVE,
            },
            update: {
              jobRole: UserRole.SALES_EXECUTIVE,
              role: companyMembershipClass(UserRole.SALES_EXECUTIVE),
            },
          });
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ASSIGNEE_NOT_FOUND") {
      return NextResponse.json(
        { ok: false as const, error: "Sales executive user not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    if (e instanceof Error && e.message === "ASSIGNEE_NOT_ELIGIBLE") {
      return NextResponse.json(
        {
          ok: false as const,
          error: "User must be an active internal sales role to assign",
          code: "VALIDATION_ERROR" as const,
        },
        { status: 400 },
      );
    }
    throw e;
  }

  const msgParts: string[] = [];
  if (data.name !== undefined) msgParts.push("profile");
  if (data.plan !== undefined || data.subscriptionStatus !== undefined || data.markInactive !== undefined)
    msgParts.push("subscription");
  if (data.archive !== undefined) msgParts.push(data.archive ? "archived" : "unarchived");
  if (data.assignedSalesExecutiveUserId !== undefined) msgParts.push("sales assignee");

  await logActivity(prisma, {
    companyId,
    userId: session.sub,
    type: ACTIVITY_TYPES.CLIENT_COMPANY_UPDATED,
    message: `Client updated (${msgParts.join(", ") || "fields"})`,
    metadata: { companyId },
  });

  if (data.archive === true) {
    await logActivity(prisma, {
      companyId,
      userId: session.sub,
      type: ACTIVITY_TYPES.CLIENT_COMPANY_ARCHIVED,
      message: `Client archived: ${existing.name}`,
      metadata: { companyId },
    });
  }

  invalidateControlCaches(companyId);
  return NextResponse.json({ ok: true as const });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const session = requireInternalPlatformApi(request);
  if (session instanceof NextResponse) return session;
  const { companyId } = await ctx.params;

  const existing = await prisma.company.findFirst({
    where: { id: companyId, internalSalesOrg: false },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false as const, error: "Company not found", code: "NOT_FOUND" as const },
      { status: 404 },
    );
  }

  await logActivity(prisma, {
    companyId,
    userId: session.sub,
    type: ACTIVITY_TYPES.CLIENT_COMPANY_DELETED,
    message: `Client company deleted: ${existing.name}`,
    metadata: { companyId },
  });

  await prisma.company.delete({ where: { id: companyId } });

  invalidateControlCaches(companyId);
  return NextResponse.json({ ok: true as const });
}
