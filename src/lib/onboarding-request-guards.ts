import "server-only";

import type { IceconnectEmployeeRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AccessTokenPayload } from "@/types";
import { getAuthUser, requireAuth } from "@/lib/auth";

export function iceconnectRoleFromPayload(user: AccessTokenPayload): IceconnectEmployeeRole | null {
  return user.iceconnectEmployeeRole ?? null;
}

export function requireIceconnectWorkforce(
  user: AccessTokenPayload,
): NextResponse | { user: AccessTokenPayload } {
  if (user.employeeSystem !== "ICECONNECT") {
    return NextResponse.json(
      { ok: false as const, error: "ICECONNECT workforce only", code: "NOT_ICECONNECT" as const },
      { status: 403 },
    );
  }
  return { user };
}

export function requireBde(user: AccessTokenPayload): NextResponse | { user: AccessTokenPayload } {
  const w = requireIceconnectWorkforce(user);
  if (w instanceof NextResponse) return w;
  if (user.iceconnectEmployeeRole !== "BDE") {
    return NextResponse.json(
      { ok: false as const, error: "BDE only", code: "FORBIDDEN_ROLE" as const },
      { status: 403 },
    );
  }
  return { user };
}

export function requireSalesReviewer(
  user: AccessTokenPayload,
): NextResponse | { user: AccessTokenPayload } {
  const w = requireIceconnectWorkforce(user);
  if (w instanceof NextResponse) return w;
  const r = user.iceconnectEmployeeRole;
  if (r !== "RSM" && r !== "BDM") {
    return NextResponse.json(
      { ok: false as const, error: "Sales review only (RSM/BDM)", code: "FORBIDDEN_ROLE" as const },
      { status: 403 },
    );
  }
  return { user };
}

/** RSM / BDM / BDE — capacity alerts & sales control panel. */
export function requireSalesChain(
  user: AccessTokenPayload,
): NextResponse | { user: AccessTokenPayload } {
  const w = requireIceconnectWorkforce(user);
  if (w instanceof NextResponse) return w;
  const r = user.iceconnectEmployeeRole;
  if (r !== "RSM" && r !== "BDM" && r !== "BDE") {
    return NextResponse.json(
      { ok: false as const, error: "Sales chain only (RSM/BDM/BDE)", code: "FORBIDDEN_ROLE" as const },
      { status: 403 },
    );
  }
  return { user };
}

export function requireTechExec(
  user: AccessTokenPayload,
): NextResponse | { user: AccessTokenPayload } {
  const w = requireIceconnectWorkforce(user);
  if (w instanceof NextResponse) return w;
  if (user.iceconnectEmployeeRole !== "TECH_EXEC") {
    return NextResponse.json(
      { ok: false as const, error: "Tech only", code: "FORBIDDEN_ROLE" as const },
      { status: 403 },
    );
  }
  return { user };
}

export function authForOnboardingApi(request: NextRequest): AccessTokenPayload | NextResponse {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  return session;
}
