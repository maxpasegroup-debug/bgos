import "server-only";

import type { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { forbidden, requireAuthWithCompany, type AuthUserWithCompany } from "./auth";
import { isIceconnectPrivileged } from "./iceconnect-scope";

function workforceRoleAllowedByLegacySet(
  user: AuthUserWithCompany,
  allowedRoles: UserRole[],
): boolean {
  if (user.employeeSystem !== "ICECONNECT" || !user.iceconnectEmployeeRole) return false;
  const allowedIceRoles = new Set<string>();
  if (allowedRoles.includes("MANAGER")) {
    allowedIceRoles.add("RSM");
    allowedIceRoles.add("BDM");
  }
  if (allowedRoles.includes("SALES_EXECUTIVE") || allowedRoles.includes("TELECALLER")) {
    allowedIceRoles.add("BDE");
  }
  if (allowedRoles.includes("TECH_HEAD") || allowedRoles.includes("TECH_EXECUTIVE")) {
    allowedIceRoles.add("TECH_EXEC");
  }
  return allowedIceRoles.has(user.iceconnectEmployeeRole);
}

export async function requireIceconnectRole(
  request: NextRequest,
  allowedRoles: UserRole[],
): Promise<AuthUserWithCompany | NextResponse> {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;
  if (isIceconnectPrivileged(user.role)) return user;
  if (allowedRoles.includes(user.role)) return user;
  if (workforceRoleAllowedByLegacySet(user, allowedRoles)) return user;
  return forbidden("This workspace is not available for your role");
}
