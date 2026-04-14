import { CompanyPlan, Prisma, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_ERROR_CODES } from "@/lib/auth-api";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { hashPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { hostTenantFromHeader } from "@/lib/host-routing";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session-cookie";
import {
  isUserEmailAlreadyRegistered,
  jsonErrorForUserUniqueViolation,
} from "@/lib/user-email-availability";
import { EMAIL_ALREADY_IN_USE_MESSAGE } from "@/lib/user-identity-messages";

const bodySchema = z.object({
  name: z
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

export async function POST(request: Request) {
  if (hostTenantFromHeader(request.headers.get("host")) === "ice") {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Registration is only available on bgos.online.",
        code: "WRONG_HOST" as const,
      },
      { status: 403 },
    );
  }

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  if (await isUserEmailAlreadyRegistered(email)) {
    return NextResponse.json(
      {
        ok: false as const,
        error: EMAIL_ALREADY_IN_USE_MESSAGE,
        code: AUTH_ERROR_CODES.EMAIL_IN_USE,
      },
      { status: 409 },
    );
  }

  let user: { id: string; name: string; email: string };

  try {
    const passwordHash = await hashPassword(password);

    const u = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
      },
    });
    user = u;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = jsonErrorForUserUniqueViolation(e);
      if (mapped) return mapped;
    }
    return handleApiError("POST /api/auth/signup", e);
  }

  let token: string;
  try {
    token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: UserRole.ADMIN,
      companyId: null,
      companyPlan: CompanyPlan.BASIC,
      workspaceReady: false,
    });
  } catch (e) {
    console.error("[auth/signup] JWT signing failed", e);
    return NextResponse.json(
      { ok: false as const, error: "Authentication is not configured", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true as const,
    redirect: "/onboarding" as const,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      needsOnboarding: true as const,
    },
  });

  setSessionCookie(res, token);

  return res;
}
