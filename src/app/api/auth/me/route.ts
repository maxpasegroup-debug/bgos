import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/** Example authenticated route; use `requireAuthWithRoles` for admin-only APIs. */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  return NextResponse.json({
    ok: true as const,
    user: {
      id: user.sub,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyPlan: user.companyPlan,
    },
  });
}
