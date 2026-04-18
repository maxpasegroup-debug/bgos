import { Prisma, SalesNetworkRole, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod, jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { deleteApiCacheByPrefix } from "@/lib/api-runtime-cache";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { hashPassword } from "@/lib/password";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { companyMembershipClass, toPublicUser } from "@/lib/user-company";
import { INTERNAL_ORG_EMPLOYEE_ROLES } from "@/lib/internal-hr-roles";
import {
  isUserEmailAlreadyRegistered,
  jsonErrorForUserUniqueViolation,
} from "@/lib/user-email-availability";
import { EMAIL_ALREADY_IN_USE_MESSAGE } from "@/lib/user-identity-messages";

function jobRoleFromSalesNetwork(r: SalesNetworkRole): UserRole {
  switch (r) {
    case SalesNetworkRole.RSM:
      return UserRole.MANAGER;
    case SalesNetworkRole.BDE:
      return UserRole.SALES_EXECUTIVE;
    case SalesNetworkRole.TECH_EXEC:
      return UserRole.TECH_EXECUTIVE;
    case SalesNetworkRole.BDM:
      return UserRole.MANAGER;
    default:
      return UserRole.SALES_EXECUTIVE;
  }
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(UserRole),
  salesNetworkRole: z.nativeEnum(SalesNetworkRole).optional(),
  parentUserId: z.string().trim().min(1).optional(),
  region: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const org = await getOrCreateInternalSalesCompanyId();
  if ("error" in org) {
    return NextResponse.json(
      { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
      { status: 500 },
    );
  }

  const companyRow = await prisma.company.findUnique({
    where: { id: org.companyId },
    select: { plan: true, internalSalesOrg: true },
  });
  if (!companyRow?.internalSalesOrg) {
    return jsonError(500, "INTERNAL_ORG", "Internal company is misconfigured");
  }

  let jobRole = parsed.data.role;
  let networkRole: SalesNetworkRole | null = parsed.data.salesNetworkRole ?? null;

  if (networkRole) {
    if (networkRole === SalesNetworkRole.BDM) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "BDM is earned via Nexa promotion (3 consecutive months on target) — not created manually.",
      );
    }
    if (networkRole === SalesNetworkRole.BOSS) {
      return jsonError(400, "VALIDATION_ERROR", "BOSS is the workspace owner — not created here.");
    }
    jobRole = jobRoleFromSalesNetwork(networkRole);
  }

  if (!INTERNAL_ORG_EMPLOYEE_ROLES.includes(jobRole)) {
    return jsonError(400, "VALIDATION_ERROR", "Choose MANAGER, SALES_EXECUTIVE, TECH_HEAD, or TECH_EXECUTIVE");
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (await isUserEmailAlreadyRegistered(email)) {
    return jsonError(409, "EMAIL_IN_USE", EMAIL_ALREADY_IN_USE_MESSAGE);
  }

  if (parsed.data.parentUserId) {
    const parent = await prisma.userCompany.findFirst({
      where: { companyId: org.companyId, userId: parsed.data.parentUserId },
    });
    if (!parent) {
      return jsonError(400, "VALIDATION_ERROR", "Parent must be a user in this workspace.");
    }
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const { user, membership } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: parsed.data.name.trim(),
          email,
          password: passwordHash,
          isActive: true,
          workspaceActivatedAt: new Date(),
        },
      });
      const mem = await tx.userCompany.create({
        data: {
          userId: u.id,
          companyId: org.companyId,
          role: companyMembershipClass(jobRole),
          jobRole,
          salesNetworkRole: networkRole,
          parentUserId: parsed.data.parentUserId ?? null,
          region: networkRole === SalesNetworkRole.RSM ? (parsed.data.region ?? null) : null,
        },
      });
      if (networkRole === SalesNetworkRole.BDE) {
        await tx.promotionTracker.create({
          data: {
            companyId: org.companyId,
            userId: u.id,
            currentStreak: 0,
            targetMet: false,
            eligibleForPromotion: false,
          },
        });
      }
      return { user: u, membership: mem };
    });

    deleteApiCacheByPrefix("control:team:");
    deleteApiCacheByPrefix("control:summary");
    return NextResponse.json(
      {
        ok: true as const,
        user: toPublicUser(user, membership),
        iceconnectNote: "Employee can sign in at ICECONNECT with this email and password.",
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = jsonErrorForUserUniqueViolation(e);
      if (mapped) return mapped;
    }
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/bgos/control/team/employees", e);
  }
}
