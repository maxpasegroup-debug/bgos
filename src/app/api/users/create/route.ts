import { Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { toPublicUser, USER_ADMIN_ROLES } from "@/lib/user-company";

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  mobile: z.string().trim().min(1).max(32),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(UserRole),
});

export async function POST(request: NextRequest) {
  const session = requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        error: parsed.error.flatten(),
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const { name, mobile, email, password, role } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        mobile,
        email: email.toLowerCase(),
        password: passwordHash,
        role,
        companyId: session.companyId,
        isActive: true,
      },
    });

    return NextResponse.json(
      { ok: true as const, user: toPublicUser(user) },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { ok: false as const, error: "Email is already registered", code: "DUPLICATE_EMAIL" },
        { status: 409 },
      );
    }
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/users/create", e);
  }
}
