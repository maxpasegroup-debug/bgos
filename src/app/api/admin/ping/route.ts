import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";

/** Example: only ADMIN or MANAGER may call this route. */
export async function GET(request: NextRequest) {
  const user = await requireAuthWithRoles(request, [UserRole.ADMIN, UserRole.MANAGER]);
  if (user instanceof NextResponse) return user;

  return NextResponse.json({
    ok: true as const,
    message: "Role check passed",
    role: user.role,
  });
}
