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
import { isAllowedHrEmployeeRole } from "@/lib/internal-hr-roles";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const createBodySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email")
      .max(320, "Email is too long"),
    mobile: z.string().trim().max(32, "Mobile is too long").optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.nativeEnum(UserRole),
  })
  .superRefine((data, ctx) => {
    const m = data.mobile?.trim();
    if (m && m.length > 0) {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        ctx.addIssue({
          code: "custom",
          path: ["mobile"],
          message: "Enter a valid mobile number (10–15 digits) or leave blank",
        });
      }
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
    select: { plan: true, internalSalesOrg: true },
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

  const internalSalesOrg = companyRow?.internalSalesOrg ?? false;
  if (!isAllowedHrEmployeeRole(internalSalesOrg, parsed.data.role)) {
    return jsonError(400, "VALIDATION_ERROR", "Choose a valid employee role for this company");
  }

  const { name, password, role } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  const mobileTrim = parsed.data.mobile?.trim();
  const mobile = mobileTrim && mobileTrim.length > 0 ? mobileTrim : null;
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
        "That email is already registered. Use another address or contact support.",
      );
    }
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/users/create", e);
  }
}
