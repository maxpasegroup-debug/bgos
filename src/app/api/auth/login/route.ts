import { CompanyPlan } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { AUTH_ERROR_CODES } from "@/lib/auth-api";
import { checkLoginRateLimit, getClientIpForRateLimit } from "@/lib/login-rate-limit";
import { mobileLookupVariants } from "@/lib/mobile-login";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";
import { setSessionCookie } from "@/lib/session-cookie";

const bodySchema = z
  .object({
    email: z.string().optional(),
    mobile: z.string().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim();
    const mobile = data.mobile?.trim();
    if (email && mobile) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Use either email or mobile",
      });
    }
    if (!email && !mobile) {
      ctx.addIssue({
        code: "custom",
        path: ["mobile"],
        message: "Mobile number or email is required",
      });
    }
    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email",
      });
    }
  });

export async function POST(request: Request) {
  const ip = getClientIpForRateLimit(request);
  const limited = checkLoginRateLimit(ip);
  if (!limited.ok) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Too many login attempts. Please wait and try again.",
        code: "RATE_LIMITED" as const,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const { password } = parsed.data;
  const email = parsed.data.email?.trim();
  const mobileRaw = parsed.data.mobile?.trim();

  let user;
  try {
    if (email) {
      user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { company: { select: { plan: true } } },
      });
    } else {
      const variants = mobileLookupVariants(mobileRaw ?? "");
      if (variants.length === 0) {
        return NextResponse.json(
          {
            ok: false as const,
            error: "Enter a valid mobile number",
            code: "VALIDATION_ERROR",
          },
          { status: 400 },
        );
      }
      user = await prisma.user.findFirst({
        where: {
          OR: variants.map((m) => ({
            mobile: { equals: m, mode: "insensitive" as const },
          })),
        },
        include: { company: { select: { plan: true } } },
      });
    }
  } catch (e) {
    return handleApiError("POST /api/auth/login", e);
  }

  const authError = NextResponse.json(
    {
      ok: false as const,
      error: email
        ? "Invalid email or password"
        : "Invalid mobile number or password",
      code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    },
    { status: 401 },
  );

  if (!user || !user.isActive) {
    return authError;
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return authError;
  }

  const companyPlan = user.company?.plan ?? CompanyPlan.BASIC;

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
