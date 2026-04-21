/**
 * ICECONNECT workforce routing — maps {@link IceconnectEmployeeRole} to dashboard paths.
 * Works with JWT payload fields: employeeSystem, iceconnectEmployeeRole, employeeDomain.
 */
import type { IceconnectEmployeeRole } from "@prisma/client";

export const ICECONNECT_EMPLOYEE_PATH: Record<IceconnectEmployeeRole, string> = {
  RSM:       "/iceconnect/rsm",
  BDM:       "/iceconnect/bdm",
  BDE:       "/iceconnect/bde",
  TECH_EXEC: "/iceconnect/sde",
};

export function iceconnectRoleHomePath(
  role: IceconnectEmployeeRole | null | undefined,
): string | null {
  if (!role) return null;
  return ICECONNECT_EMPLOYEE_PATH[role] ?? null;
}

export function isIceconnectWorkforceJwt(system: unknown): boolean {
  return system === "ICECONNECT";
}

export function requiresIceconnectSystemForPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return (
    p === "/iceconnect/rsm" ||
    p === "/iceconnect/bdm" ||
    p === "/iceconnect/bde" ||
    p === "/iceconnect/onboard" ||
    p === "/iceconnect/sales/onboarding" ||
    p.startsWith("/iceconnect/sales/onboarding/") ||
    p === "/iceconnect/sde" ||
    p.startsWith("/iceconnect/sde/")
  );
}

/** Expected JWT iceconnectEmployeeRole for a path (strict routes only). */
export function expectedRoleForIceconnectPath(
  pathname: string,
): IceconnectEmployeeRole | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/iceconnect/rsm") return "RSM";
  if (p === "/iceconnect/bdm") return "BDM";
  if (p === "/iceconnect/bde") return "BDE";
  if (p === "/iceconnect/sde" || p.startsWith("/iceconnect/sde/")) return "TECH_EXEC";
  return null;
}

/**
 * Middleware tri-state: allow (skip jobRole rules), deny (redirect), legacy (use roleCanAccessPath).
 */
function iceconnectStrictRole(
  payload: Record<string, unknown>,
  allowed: IceconnectEmployeeRole | readonly IceconnectEmployeeRole[],
): "allow" | "deny" {
  const sys = payload.employeeSystem;
  const ier = payload.iceconnectEmployeeRole as IceconnectEmployeeRole | undefined;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (ier != null && sys === "ICECONNECT") {
    return list.includes(ier) ? "allow" : "deny";
  }
  if (ier != null && sys !== "ICECONNECT") return "deny";
  return "deny";
}

/**
 * Middleware tri-state: allow (skip jobRole rules), deny (redirect), legacy (use roleCanAccessPath).
 */
export function iceconnectEmployeePathAllowed(
  pathname: string,
  payload: Record<string, unknown>,
): "allow" | "deny" | "legacy" {
  const p = pathname.replace(/\/+$/, "") || "/";

  if (p === "/iceconnect/sales/control" || p.startsWith("/iceconnect/sales/control/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM", "BDE"]);
  }
  if (p === "/iceconnect/sales/report" || p.startsWith("/iceconnect/sales/report/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM"]);
  }
  if (p === "/api/iceconnect/sales/report" || p.startsWith("/api/iceconnect/sales/report/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM"]);
  }
  if (p === "/api/onboarding-requests" || p.startsWith("/api/onboarding-requests/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM", "BDE", "TECH_EXEC"]);
  }
  if (p === "/api/iceconnect/bde" || p.startsWith("/api/iceconnect/bde/")) {
    return iceconnectStrictRole(payload, "BDE");
  }
  if (p === "/api/iceconnect/usage/control" || p.startsWith("/api/iceconnect/usage/control/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM", "BDE"]);
  }
  if (p === "/api/iceconnect/usage/flags" || p.startsWith("/api/iceconnect/usage/flags/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM", "BDE"]);
  }
  if (p === "/api/iceconnect/usage/rsm-overview" || p.startsWith("/api/iceconnect/usage/rsm-overview/")) {
    return iceconnectStrictRole(payload, "RSM");
  }
  if (p === "/api/iceconnect/usage/bde-alerts" || p.startsWith("/api/iceconnect/usage/bde-alerts/")) {
    return iceconnectStrictRole(payload, "BDE");
  }

  if (p === "/iceconnect/onboard") {
    return iceconnectStrictRole(payload, "BDE");
  }
  if (p === "/iceconnect/sales/onboarding" || p.startsWith("/iceconnect/sales/onboarding/")) {
    return iceconnectStrictRole(payload, ["RSM", "BDM"]);
  }

  const expected = expectedRoleForIceconnectPath(pathname);
  if (!expected) return "legacy";

  const sys = payload.employeeSystem;
  const ier = payload.iceconnectEmployeeRole as IceconnectEmployeeRole | undefined;

  if (ier != null && sys === "ICECONNECT") {
    return ier === expected ? "allow" : "deny";
  }
  if (ier != null && sys !== "ICECONNECT") return "deny";

  // Legacy JWT (no iceconnect fields): only /iceconnect/tech* falls back to UserRole rules.
  if (expected === "TECH_EXEC") return "legacy";
  return "deny";
}
