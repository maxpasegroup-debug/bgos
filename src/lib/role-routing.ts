/**
 * Role → default app home (BGOS vs ICECONNECT). Safe for Edge middleware and client.
 * ADMIN (and MANAGER) → boss app `/bgos`; field roles → their ICECONNECT dashboard.
 */

export const ROLE_HOME: Readonly<Record<string, string>> = {
  ADMIN: "/bgos",
  MANAGER: "/bgos",
  TELECALLER: "/iceconnect/sales",
  ENGINEER: "/iceconnect/site",
  INSTALLER: "/iceconnect/install",
  ACCOUNTS: "/iceconnect/accounts",
  SERVICE: "/iceconnect/service",
};

const PRIVILEGED = new Set<string>(["ADMIN", "MANAGER"]);

type RouteRule = { prefix: string; roles: Set<string> };

const PAGE_RULES: RouteRule[] = [
  { prefix: "/bgos", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/sales", roles: new Set(["TELECALLER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/site", roles: new Set(["ENGINEER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/install", roles: new Set(["INSTALLER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/accounts", roles: new Set(["ACCOUNTS", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/service", roles: new Set(["SERVICE", "ADMIN", "MANAGER"]) },
];

const API_RULES: RouteRule[] = [
  { prefix: "/api/dashboard", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/activity", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/automation", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/pipeline", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/users", roles: new Set(["ADMIN"]) },
  { prefix: "/api/leads", roles: new Set(["TELECALLER", "ADMIN", "MANAGER"]) },
  { prefix: "/api/tasks", roles: new Set(["TELECALLER", "ADMIN", "MANAGER"]) },
  {
    prefix: "/api/iceconnect",
    roles: new Set([
      "TELECALLER",
      "ENGINEER",
      "INSTALLER",
      "ACCOUNTS",
      "SERVICE",
      "ADMIN",
      "MANAGER",
    ]),
  },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function allowedByRules(pathname: string, role: string, rules: RouteRule[]): boolean | null {
  for (const { prefix, roles } of rules) {
    if (matchesPrefix(pathname, prefix)) {
      return roles.has(role);
    }
  }
  return null;
}

/**
 * Whether this role may access this pathname (pages + role-scoped APIs).
 * ADMIN and MANAGER may access all defined areas.
 */
export function roleCanAccessPath(role: string, pathname: string): boolean {
  if (pathname === "/iceconnect" || pathname === "/iceconnect/") {
    return PRIVILEGED.has(role);
  }

  if (PRIVILEGED.has(role)) return true;

  const page = allowedByRules(pathname, role, PAGE_RULES);
  if (page !== null) return page;

  const api = allowedByRules(pathname, role, API_RULES);
  if (api !== null) return api;

  return true;
}

export function getRoleHome(role: string): string {
  return ROLE_HOME[role] ?? "/iceconnect";
}

/**
 * After login: honor `from` only if the role may open that path.
 * Default: ADMIN → `/bgos`, all other roles → `/iceconnect` (middleware then sends users to role home if needed).
 */
export function postLoginDestination(role: string, from: string | null): string {
  if (from && from.startsWith("/") && roleCanAccessPath(role, from)) {
    return from;
  }
  if (role === "ADMIN") return "/bgos";
  return "/iceconnect";
}

/** Path segment after `/iceconnect/` → roles allowed on that dashboard. */
export const ICECONNECT_DASHBOARD_ROLES: Record<string, readonly string[]> = {
  sales: ["TELECALLER", "ADMIN", "MANAGER"],
  site: ["ENGINEER", "ADMIN", "MANAGER"],
  install: ["INSTALLER", "ADMIN", "MANAGER"],
  accounts: ["ACCOUNTS", "ADMIN", "MANAGER"],
  service: ["SERVICE", "ADMIN", "MANAGER"],
};

export function canAccessIceconnectDashboard(segment: string, role: string): boolean {
  const allowed = ICECONNECT_DASHBOARD_ROLES[segment];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(role);
}
