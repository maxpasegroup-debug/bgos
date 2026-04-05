import "server-only";

import { CompanyPlan } from "@prisma/client";
import { NextResponse } from "next/server";
import type { AuthUser } from "./auth";

export function userHasProPlan(user: AuthUser): boolean {
  return user.companyPlan === CompanyPlan.PRO;
}

export function proPlanRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: "This feature requires a Pro plan",
      code: "PLAN_PRO_REQUIRED",
    },
    { status: 403 },
  );
}

/** Returns a 403 response if the user is not on Pro; otherwise `null`. */
export function requireProPlan(user: AuthUser): NextResponse | null {
  if (!userHasProPlan(user)) return proPlanRequiredResponse();
  return null;
}
