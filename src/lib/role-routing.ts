/**
 * Role → default app home (BGOS vs ICECONNECT). Safe for Edge middleware and client.
 * ADMIN (and MANAGER) → boss app `/bgos`; field roles → their ICECONNECT dashboard.
 */

export const ROLE_HOME: Readonly<Record<string, string>> = {
  ADMIN: "/bgos",
  MANAGER: "/bgos",
  SALES_EXECUTIVE: "/iceconnect/sales",
  TELECALLER: "/iceconnect/sales",
  SALES_HEAD: "/iceconnect/sales-head",
  CHANNEL_PARTNER: "/iceconnect/partner",
  OPERATIONS_HEAD: "/iceconnect/operations",
  SITE_ENGINEER: "/iceconnect/site",
  PRO: "/iceconnect/pro",
  INSTALLATION_TEAM: "/iceconnect/install",
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
    prefix: "/api/leads",
    roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "SALES_HEAD", "ADMIN", "MANAGER"]),
  },
  {
    prefix: "/api/tasks",
    roles: new Set(["SALES_EXECUTIVE", "TELECALLER", "SALES_HEAD", "ADMIN", "MANAGER"]),
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
  sales: ["SALES_EXECUTIVE", "TELECALLER", "ADMIN", "MANAGER"],
  "sales-head": ["SALES_HEAD", "ADMIN", "MANAGER"],
  partner: ["CHANNEL_PARTNER", "ADMIN", "MANAGER"],
  operations: ["OPERATIONS_HEAD", "ADMIN", "MANAGER"],
  site: ["SITE_ENGINEER", "ADMIN", "MANAGER"],
  pro: ["PRO", "ADMIN", "MANAGER"],
  install: ["INSTALLATION_TEAM", "ADMIN", "MANAGER"],
  service: ["SERVICE_TEAM", "ADMIN", "MANAGER"],
  inventory: ["INVENTORY_MANAGER", "ADMIN", "MANAGER"],
  accounts: ["ACCOUNTANT", "ADMIN", "MANAGER"],
  loan: ["LCO", "ADMIN", "MANAGER"],
  hr: ["HR_MANAGER", "ADMIN", "MANAGER"],
  documents: [...DOCUMENT_VAULT_ROLES_LIST],
};

export function canAccessIceconnectDashboard(segment: string, role: string): boolean {
  const allowed = ICECONNECT_DASHBOARD_ROLES[segment];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(role);
}
