import { Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod, jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
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

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(UserRole),
});

export async function POST(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (!INTERNAL_ORG_EMPLOYEE_ROLES.includes(parsed.data.role)) {
    return jsonError(400, "VALIDATION_ERROR", "Choose MANAGER, SALES_EXECUTIVE, TECH_HEAD, or TECH_EXECUTIVE");
  }

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

  const email = parsed.data.email.trim().toLowerCase();

  if (await isUserEmailAlreadyRegistered(email)) {
    return jsonError(409, "EMAIL_IN_USE", EMAIL_ALREADY_IN_USE_MESSAGE);
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
          role: companyMembershipClass(parsed.data.role),
          jobRole: parsed.data.role,
        },
      });
      return { user: u, membership: mem };
    });

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
