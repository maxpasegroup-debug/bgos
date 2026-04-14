/**
 * Role → default app home (BGOS vs ICECONNECT). Safe for Edge middleware and client.
 * Company ADMIN (boss) defaults to BGOS; managers / execs use ICECONNECT hubs.
 */

/** Platform owner (`BGOS_BOSS_EMAIL` + JWT `superBoss`) — internal control plane, not tenant solar dashboard. */
export const SUPER_BOSS_HOME_PATH = "/bgos/control/clients";

export const ROLE_HOME: Readonly<Record<string, string>> = {
  ADMIN: "/bgos/dashboard",
  MANAGER: "/iceconnect/internal-sales",
  SALES_EXECUTIVE: "/iceconnect/my-journey",
  TELECALLER: "/iceconnect/my-journey",
  TECH_HEAD: "/iceconnect/my-journey",
  TECH_EXECUTIVE: "/iceconnect/my-journey",
  SALES_HEAD: "/iceconnect/sales-head",
  CHANNEL_PARTNER: "/iceconnect/partner",
  OPERATIONS_HEAD: "/iceconnect/operations",
  /** Field tech roles default to internal workspace when using BGOS Internal; adjust if you need classic field dashboards. */
  SITE_ENGINEER: "/iceconnect/internal-sales",
  PRO: "/iceconnect/internal-sales",
  INSTALLATION_TEAM: "/iceconnect/internal-sales",
  SERVICE_TEAM: "/iceconnect/service",
  INVENTORY_MANAGER: "/iceconnect/inventory",
  ACCOUNTANT: "/iceconnect/accounts",
  LCO: "/iceconnect/loan",
  HR_MANAGER: "/iceconnect/hr",
};

/** Roles that may use the company document vault (BGOS + `/iceconnect/documents` + `/api/document/*`). */
export const DOCUMENT_VAULT_ROLES_LIST = [
  "ADMIN",
  "MANAGER",
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

const PRIVILEGED = new Set<string>(["ADMIN", "MANAGER"]);

/** ICECONNECT internal sales hub (My Journey, metro leads, wallet). Boss (ADMIN) uses BGOS only. */
const ICE_INTERNAL_SALES_HUB = new Set<string>([
  "SALES_EXECUTIVE",
  "TELECALLER",
  "MANAGER",
  "TECH_HEAD",
  "TECH_EXECUTIVE",
]);

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
  { prefix: "/bgos", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/sales-booster", roles: new Set(["ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/sales", roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/sales-head", roles: new Set(["SALES_HEAD", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/partner", roles: new Set(["CHANNEL_PARTNER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/operations", roles: new Set(["OPERATIONS_HEAD", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/site", roles: new Set(["SITE_ENGINEER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/pro", roles: new Set(["PRO", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/install", roles: new Set(["INSTALLATION_TEAM", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/service", roles: new Set(["SERVICE_TEAM", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/inventory", roles: new Set(["INVENTORY_MANAGER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/accounts", roles: new Set(["ACCOUNTANT", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/loan", roles: new Set(["LCO", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/hr", roles: new Set(["HR_MANAGER", "ADMIN", "MANAGER"]) },
  { prefix: "/iceconnect/my-journey", roles: ICE_INTERNAL_SALES_HUB },
  { prefix: "/iceconnect/leads", roles: ICE_INTERNAL_SALES_HUB },
  { prefix: "/iceconnect/customers", roles: ICE_INTERNAL_SALES_HUB },
  { prefix: "/iceconnect/wallet", roles: ICE_INTERNAL_SALES_HUB },
  { prefix: "/iceconnect/notifications", roles: ICE_INTERNAL_SALES_HUB },
  { prefix: "/iceconnect/profile", roles: ICE_INTERNAL_SALES_HUB },
  { prefix: "/onboarding/manage", roles: ONBOARDING_WORKFLOW_ROLES },
  {
    prefix: "/iceconnect/tech/onboarding",
    roles: new Set(["TECH_HEAD", "TECH_EXECUTIVE", "ADMIN", "MANAGER"]),
  },
  {
    prefix: "/iceconnect/internal-sales",
    roles: new Set([
      "SALES_EXECUTIVE",
      "TELECALLER",
      "ADMIN",
      "MANAGER",
      "TECH_HEAD",
      "TECH_EXECUTIVE",
    ]),
  },
  {
    prefix: "/iceconnect/internal-tech",
    roles: new Set(["TECH_HEAD", "TECH_EXECUTIVE", "ADMIN", "MANAGER"]),
  },
  {
    prefix: "/bgos/internal-tech",
    roles: new Set(["TECH_HEAD", "TECH_EXECUTIVE", "ADMIN", "MANAGER"]),
  },
  {
    prefix: "/iceconnect/internal-onboarding",
    roles: new Set([
      "MANAGER",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
    ]),
  },
  {
    prefix: "/bgos/internal-onboarding",
    roles: new Set([
      "ADMIN",
      "MANAGER",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
    ]),
  },
  { prefix: "/iceconnect/documents", roles: DOCUMENT_VAULT_ROLES },
];

const API_RULES: RouteRule[] = [
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
      "MANAGER",
      "TECH_HEAD",
      "TECH_EXECUTIVE",
      "OPERATIONS_HEAD",
      "SITE_ENGINEER",
      "PRO",
      "INSTALLATION_TEAM",
    ]),
  },
  {
    prefix: "/api/leads",
    roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "SALES_HEAD", "ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/tasks",
    roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "SALES_HEAD", "ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/iceconnect/executive",
    roles: ICE_INTERNAL_SALES_HUB,
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
      "MANAGER",
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

  if (opts?.superBoss === true) {
    if (p === "/bgos" || p === "/iceconnect" || p.startsWith("/iceconnect/")) {
      return false;
    }
    if (superBossAllowedPath(p)) return true;
    return false;
  }

  if (p === "/bgos/control" || p.startsWith("/bgos/control/")) {
    return false;
  }

  /** Company boss: BGOS + boss APIs only — never employee ICECONNECT surfaces (any host / dev). */
  if (role === "ADMIN" && !opts?.superBoss) {
    if (p === "/iceconnect" || p.startsWith("/iceconnect/")) return false;
    if (p.startsWith("/api/iceconnect") || p.startsWith("/api/internal-sales")) return false;
  }

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
  "my-journey": ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  leads: ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  customers: ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  wallet: ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  notifications: ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  profile: ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  "tech-onboarding": ["TECH_HEAD", "TECH_EXECUTIVE", "MANAGER"],
  sales: ["SALES_EXECUTIVE", "TELECALLER", "MANAGER"],
  "sales-head": ["SALES_HEAD", "MANAGER"],
  partner: ["CHANNEL_PARTNER", "MANAGER"],
  operations: ["OPERATIONS_HEAD", "MANAGER"],
  site: ["SITE_ENGINEER", "MANAGER"],
  pro: ["PRO", "MANAGER"],
  install: ["INSTALLATION_TEAM", "MANAGER"],
  service: ["SERVICE_TEAM", "MANAGER"],
  inventory: ["INVENTORY_MANAGER", "MANAGER"],
  accounts: ["ACCOUNTANT", "MANAGER"],
  loan: ["LCO", "MANAGER"],
  hr: ["HR_MANAGER", "MANAGER"],
  "internal-sales": ["SALES_EXECUTIVE", "TELECALLER", "MANAGER", "TECH_HEAD", "TECH_EXECUTIVE"],
  "internal-tech": ["TECH_HEAD", "TECH_EXECUTIVE", "MANAGER"],
  "internal-onboarding": [
    "MANAGER",
    "OPERATIONS_HEAD",
    "SITE_ENGINEER",
    "PRO",
    "INSTALLATION_TEAM",
  ],
  documents: [...DOCUMENT_VAULT_ROLES_LIST],
};

export function canAccessIceconnectDashboard(segment: string, role: string): boolean {
  const allowed = ICECONNECT_DASHBOARD_ROLES[segment];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(role);
}
