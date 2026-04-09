import { randomBytes } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import {
  companyMembershipClass,
  toPublicUser,
  USER_ADMIN_ROLES,
} from "@/lib/user-company";
import {
  BASIC_PLAN_MAX_MEMBERS,
  basicPlanMemberLimitReached,
} from "@/lib/plan-seats";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

/** Roles the Add Employee form may assign (field staff bound to the boss company). */
const ASSIGNABLE_EMPLOYEE_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SALES_HEAD,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.OPERATIONS_HEAD,
  UserRole.SITE_ENGINEER,
  UserRole.INSTALLATION_TEAM,
  UserRole.ACCOUNTANT,
  UserRole.HR_MANAGER,
]);

function syntheticEmailFromMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "").slice(-10) || "0000000000";
  const salt = randomBytes(4).toString("hex");
  return `employee.${digits}.${salt}@bgos-employee.invalid`;
}

const createBodySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
    mobile: z
      .string()
      .trim()
      .min(1, "Mobile is required")
      .max(32, "Mobile is too long"),
    email: z.string().trim().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.nativeEnum(UserRole),
  })
  .superRefine((data, ctx) => {
    const digits = data.mobile.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      ctx.addIssue({
        code: "custom",
        path: ["mobile"],
        message: "Enter a valid mobile number (10–15 digits)",
      });
    }
    if (!ASSIGNABLE_EMPLOYEE_ROLES.has(data.role)) {
      ctx.addIssue({
        code: "custom",
        path: ["role"],
        message: "Choose a valid employee role",
      });
    }
    const em = data.email?.trim();
    if (em && em.length > 0 && !z.string().email().safeParse(em).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email or leave blank",
      });
    }
  });

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const companyRow = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { plan: true },
  });
  if (companyRow && (await basicPlanMemberLimitReached(session.companyId, companyRow.plan))) {
    return jsonError(
      403,
      "PLAN_SEAT_LIMIT",
      `Basic plan supports up to ${BASIC_PLAN_MAX_MEMBERS} team members. Upgrade to Pro for a larger team.`,
    );
  }

  const parsed = await parseJsonBodyZod(request, createBodySchema);
  if (!parsed.ok) return parsed.response;

  const { name, mobile, password, role } = parsed.data;
  const emailRaw = parsed.data.email?.trim();
  const email = emailRaw && emailRaw.length > 0 ? emailRaw.toLowerCase() : syntheticEmailFromMobile(mobile);
  const passwordHash = await hashPassword(password);

  try {
    const { user, membership } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name,
          mobile,
          email,
          password: passwordHash,
          isActive: true,
          workspaceActivatedAt: new Date(),
        },
      });
      const mem = await tx.userCompany.create({
        data: {
          userId: u.id,
          companyId: session.companyId,
          role: companyMembershipClass(role),
          jobRole: role,
        },
      });
      return { user: u, membership: mem };
    });

    return NextResponse.json(
      { ok: true as const, user: toPublicUser(user, membership) },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(
        409,
        "DUPLICATE_EMAIL",
        "That email or mobile is already registered. Use another or reset the existing account.",
      );
    }
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/users/create", e);
  }
}
