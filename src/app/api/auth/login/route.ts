import { CompanyPlan } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  internalServerErrorResponse,
  parseJsonBody,
  zodValidationErrorResponse,
} from "@/lib/api-response";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signAccessToken } from "@/lib/jwt";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const { email, password } = parsed.data;

  let user;
  try {
    user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    include: { company: { select: { plan: true } } },
  });
  } catch (e) {
    console.error("[POST /api/auth/login]", e);
    return internalServerErrorResponse();
  }

  if (!user || !user.isActive) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
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

  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
