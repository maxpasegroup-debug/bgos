/**
 * Role → default app home (BGOS vs ICECONNECT). Safe for Edge middleware and client.
 * Company ADMIN (boss) defaults to BGOS; managers / execs use ICECONNECT hubs.
 */

/** Platform owner (`BGOS_BOSS_EMAIL` + JWT `superBoss`) — internal control plane, not tenant solar dashboard. */
export const SUPER_BOSS_HOME_PATH = "/bgos/control";
export const TECH_EXEC_HOME_PATH = "/iceconnect/sde";
export const MICRO_FRANCHISE_HOME_PATH = "/iceconnect/micro-franchise";

export const ROLE_HOME: Record<string, string> = {
  // Boss roles -> BGOS dashboard
  ADMIN: "/bgos/dashboard",
  MANAGER: "/bgos/dashboard",
  BDM: "/iceconnect/bdm",

  // BGOS Employee roles -> ICECONNECT dashboards
  SALES_HEAD: "/iceconnect/rsm",
  SALES_EXECUTIVE: "/iceconnect/bdm",
  TELECALLER: "/iceconnect/bde",
  TECH_EXECUTIVE: TECH_EXEC_HOME_PATH,
  TECH_HEAD: TECH_EXEC_HOME_PATH,
};

/** Roles that may use the company document vault (BGOS + `/iceconnect/documents` + `/api/document/*`). */
export const DOCUMENT_VAULT_ROLES_LIST = [
  "ADMIN",
  "SALES_HEAD",
  "SALES_EXECUTIVE",
  "TELECALLER",
  "CHANNEL_PARTNER",
  "OPERATIONS_HEAD",
  "SITE_ENGINEER",
  "PRO",
  "INSTALLATION_TEAM",
  "SERVICE_TEAM",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
  "LCO",
  "HR_MANAGER",
] as const;

export const DOCUMENT_VAULT_ROLES = new Set<string>(DOCUMENT_VAULT_ROLES_LIST);

/** ICECONNECT sales workspace (leads/customers/wallet). */
const ICE_SALES_HUB = new Set<string>(["SALES_EXECUTIVE", "TELECALLER"]);

/** BGOS onboarding workflow engine (forms, tech queue, delivery). */
const ONBOARDING_WORKFLOW_ROLES = new Set<string>([
  "ADMIN",
  "MANAGER",
  "SALES_EXECUTIVE",
  "TELECALLER",
  "SALES_HEAD",
  "TECH_HEAD",
  "TECH_EXECUTIVE",
]);

type RouteRule = { prefix: string; roles: Set<string> };

const PAGE_RULES: RouteRule[] = [
  { prefix: "/solar-boss", roles: new Set(["ADMIN"]) },
  { prefix: "/bgos", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/sales-booster", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/rsm", roles: new Set(["RSM"]) },
  { prefix: "/iceconnect/bdm", roles: new Set(["BDM"]) },
  { prefix: "/iceconnect/bde", roles: new Set(["BDE"]) },
  { prefix: "/iceconnect/sde", roles: new Set(["TECH_EXECUTIVE", "TECH_HEAD", "ADMIN"]) },
];

const API_RULES: RouteRule[] = [
  { prefix: "/api/manager", roles: new Set(["MANAGER"]) },
  {
    prefix: "/api/onboarding/launch",
    roles: new Set(["ADMIN", "MANAGER", "SALES_EXECUTIVE", "TELECALLER"]),
  },
  {
    prefix: "/api/onboarding/activate",
    roles: new Set(["ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/company/create",
    roles: new Set(["ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/company/list",
    roles: new Set(["ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/company/switch",
    roles: new Set(["ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/company/current",
    roles: new Set(["ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/company/settings",
    roles: new Set(["ADMIN", "MANAGER"]),
  },
  { prefix: "/api/bgos/sales-booster", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/dashboard", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/activity", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/automation", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/pipeline", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/quotation", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/invoice", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/payment", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/expense", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/api/document", roles: DOCUMENT_VAULT_ROLES },
  {
    prefix: "/api/inventory",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "INVENTORY_MANAGER",
      "OPERATIONS_HEAD",
      "INSTALLATION_TEAM",
    ]),
  },
  {
    prefix: "/api/partner",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "CHANNEL_PARTNER",
      "SALES_HEAD",
      "SALES_EXECUTIVE",
      "TELECALLER",
    ]),
  },
  {
    prefix: "/api/commission",
    roles: new Set(["ADMIN", "MANAGER", "ACCOUNTANT", "SALES_HEAD", "CHANNEL_PARTNER"]),
  },
  {
    prefix: "/api/operations",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
      "SERVICE_TEAM",
    ]),
  },
  {
    prefix: "/api/hr",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "HR_MANAGER",
      "SALES_HEAD",
      "SALES_EXECUTIVE",
      "TELECALLER",
      "CHANNEL_PARTNER",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
      "SERVICE_TEAM",
      "INVENTORY_MANAGER",
      "ACCOUNTANT",
      "LCO",
    ]),
  },
  {
    prefix: "/api/sales",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "SALES_EXECUTIVE",
      "SALES_HEAD",
      "TELECALLER",
      "TECH_HEAD",
      "TECH_EXECUTIVE",
    ]),
  },
  {
    prefix: "/api/nexa",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "HR_MANAGER",
      "SALES_HEAD",
      "SALES_EXECUTIVE",
      "TELECALLER",
      "CHANNEL_PARTNER",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
      "SERVICE_TEAM",
      "INVENTORY_MANAGER",
      "ACCOUNTANT",
      "LCO",
    ]),
  },
  {
    prefix: "/api/internal-sales",
    roles: new Set([
      "SALES_EXECUTIVE",
      "TELECALLER",
      "ADMIN",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
    ]),
  },
  {
    prefix: "/api/leads",
    roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "SALES_HEAD", "ADMIN"]),
  },
  {
    prefix: "/api/tasks",
    roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "SALES_HEAD", "ADMIN"]),
  },
  {
    prefix: "/api/iceconnect/executive",
    roles: ICE_SALES_HUB,
  },
  {
    prefix: "/api/iceconnect/onboarding",
    roles: ICE_SALES_HUB,
  },
  {
    prefix: "/api/onboarding/workflow/create",
    roles: ONBOARDING_WORKFLOW_ROLES,
  },
  {
    prefix: "/api/onboarding/workflow/submissions",
    roles: ONBOARDING_WORKFLOW_ROLES,
  },
  {
    prefix: "/api/onboarding/workflow/tech",
    roles: ONBOARDING_WORKFLOW_ROLES,
  },
  {
    prefix: "/api/onboarding/workflow/custom",
    roles: ONBOARDING_WORKFLOW_ROLES,
  },
  {
    prefix: "/api/micro-franchise/partner",
    roles: new Set(["MICRO_FRANCHISE"]),
  },
  {
    prefix: "/api/iceconnect",
    roles: new Set([
      "SALES_HEAD",
      "SALES_EXECUTIVE",
      "TELECALLER",
      "CHANNEL_PARTNER",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
      "SERVICE_TEAM",
      "INVENTORY_MANAGER",
      "ACCOUNTANT",
      "LCO",
      "HR_MANAGER",
      "ADMIN",
      "TECH_HEAD",
      "TECH_EXECUTIVE",
    ]),
  },
  {
    prefix: "/api/users",
    roles: new Set(["ADMIN", "MANAGER"]),
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

export type RoleAccessOpts = {
  /** Platform owner only — see {@link process.env.BGOS_BOSS_EMAIL} + JWT `superBoss`. */
  superBoss?: boolean;
};

function normalizePathnameRole(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

function superBossAllowedPath(p: string): boolean {
  if (p === "/bgos/dashboard" || p.startsWith("/bgos/dashboard/")) return false;
  if (p === "/bgos/control" || p.startsWith("/bgos/control/")) return true;
  if (p === "/sales-booster" || p.startsWith("/sales-booster/")) return true;
  if (p === "/onboarding" || p.startsWith("/onboarding/")) return true;
  if (p.startsWith("/bgos/")) return true;
  if (p.startsWith("/api")) return true;
  return false;
}

/**
 * Whether this role may access this pathname (pages + role-scoped APIs).
 * Platform super boss uses `/bgos/control/*` (not tenant `/bgos/dashboard`). `/bgos` (index) and `/iceconnect/*` are blocked on purpose;
 * other `/bgos/*` paths remain available for internal tools.
 */
export function roleCanAccessPath(
  role: string,
  pathname: string,
  opts?: RoleAccessOpts,
): boolean {
  const p = normalizePathnameRole(pathname);

  if (
    role === "TECH_EXECUTIVE" &&
    (
      p === "/iceconnect/leads" ||
      p.startsWith("/iceconnect/leads/") ||
      p === "/api/internal-sales" ||
      p.startsWith("/api/internal-sales/")
    )
  ) {
    return false;
  }

  if (opts?.superBoss === true) {
    if (p === "/bgos" || p === "/iceconnect" || p.startsWith("/iceconnect/")) {
      return false;
    }
    if (superBossAllowedPath(p)) return true;
    return false;
  }

  /** Internal control plane: only the configured platform owner (`superBoss` + BGOS_BOSS_EMAIL). */
  if (p === "/bgos/control" || p.startsWith("/bgos/control/")) {
    return false;
  }

  /** Company boss: BGOS + boss APIs only — never employee ICECONNECT surfaces (any host / dev). */
  if (role === "ADMIN" && !opts?.superBoss) {
    if (p === "/iceconnect" || p.startsWith("/iceconnect/")) return false;
    if (p.startsWith("/api/iceconnect") || p.startsWith("/api/internal-sales")) return false;
  }

  if (pathname === "/iceconnect" || pathname === "/iceconnect/") {
    return false;
  }

  const page = allowedByRules(pathname, role, PAGE_RULES);
  if (page !== null) return page;

  const api = allowedByRules(pathname, role, API_RULES);
  if (api !== null) return api;

  /** MANAGER: unmatched ICECONNECT paths are denied (allowed routes matched above). */
  if (role === "MANAGER" && (p === "/iceconnect" || p.startsWith("/iceconnect/"))) {
    return false;
  }

  return true;
}

export function getRoleHome(role: string): string {
  return ROLE_HOME[role] ?? "/iceconnect";
}

/**
 * After login: honor `from` only if the role may open that path.
 * Otherwise use {@link getRoleHome} (no blank `/iceconnect` landing for known roles).
 */
export function postLoginDestination(
  role: string,
  from: string | null,
  opts?: RoleAccessOpts,
): string {
  if (opts?.superBoss === true) {
    return SUPER_BOSS_HOME_PATH;
  }
  if (from && from.startsWith("/") && roleCanAccessPath(role, from, opts)) {
    return from;
  }
  return getRoleHome(role);
}

/** Path segment after `/iceconnect/` → roles allowed on that dashboard. */
export const ICECONNECT_DASHBOARD_ROLES: Record<string, readonly string[]> = {
  rsm: ["RSM"],
  bdm: ["BDM"],
  bde: ["BDE"],
  sde: ["TECH_EXECUTIVE", "TECH_HEAD", "ADMIN"],
};

export function canAccessIceconnectDashboard(segment: string, role: string): boolean {
  const allowed = ICECONNECT_DASHBOARD_ROLES[segment];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(role);
}
