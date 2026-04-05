import { CompanyPlan, Prisma, UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_ERROR_CODES } from "@/lib/auth-api";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { hashPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { applySolarTemplate } from "@/lib/industry-templates";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session-cookie";

const bodySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(200, "Company name is too long"),
  ownerName: z
    .string()
    .trim()
    .min(1, "Your name is required")
    .max(120, "Name is too long"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email")
    .max(254, "Email is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

function syntheticMobile(): string {
  return `sign-${randomBytes(12).toString("hex")}`;
}

export async function POST(request: Request) {
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const { companyName, ownerName, password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  let company: { id: string; name: string; plan: CompanyPlan };
  let user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    companyId: string;
  };

  try {
    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const co = await tx.company.create({
        data: { name: companyName },
      });
      const u = await tx.user.create({
        data: {
          name: ownerName,
          email,
          mobile: syntheticMobile(),
          password: passwordHash,
          role: UserRole.ADMIN,
          companyId: co.id,
        },
      });
      return { company: co, user: u };
    });

    company = result.company;
    user = result.user;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        {
          ok: false as const,
          error: "An account with this email already exists",
          code: AUTH_ERROR_CODES.EMAIL_TAKEN,
        },
        { status: 409 },
      );
    }
    return handleApiError("POST /api/auth/signup", e);
  }

  try {
    await applySolarTemplate(company.id);
  } catch (e) {
    createLogger("signup").error("applySolarTemplate failed", e, { companyId: company.id });
  }

  const companyPlan = company.plan ?? CompanyPlan.BASIC;

  let token: string;
  try {
    token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyPlan,
    });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Authentication is not configured", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true as const,
    redirect: "/bgos" as const,
    company: {
      id: company.id,
      name: company.name,
      plan: companyPlan,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyPlan,
    },
  });

  setSessionCookie(res, token);

  return res;
}
