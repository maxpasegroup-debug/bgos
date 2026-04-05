import "server-only";

import type { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { forbidden, requireAuth, type AuthUser } from "./auth";
import { isIceconnectPrivileged } from "./iceconnect-scope";

export function requireIceconnectRole(
  request: NextRequest,
  allowedRoles: UserRole[],
): AuthUser | NextResponse {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (isIceconnectPrivileged(user.role)) return user;
  if (allowedRoles.includes(user.role)) return user;
  return forbidden("This workspace is not available for your role");
}
