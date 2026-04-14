import { UserRole } from "@prisma/client";

export type NexaParsedMember = {
  name: string;
  roleRaw: string;
};

export type NexaMappedMember = {
  name: string;
  roleRaw: string;
  department: "SALES" | "ADMIN" | "TECH" | "OTHER";
  dashboard: "SALES_DASHBOARD" | "ADMIN_DASHBOARD" | "TECH_DASHBOARD" | "GENERAL_DASHBOARD";
  userRole: UserRole;
  email?: string;
};

const ROLE_MAP = {
  sales: ["sales", "sales manager", "sales executive", "marketing", "marketing guy"],
  admin: ["admin", "office", "account", "hr", "office boy"],
  tech: ["technician", "engineer", "installer", "service", "field staff"],
} as const;

function roleToDepartment(roleRaw: string): NexaMappedMember["department"] {
  const role = roleRaw.toLowerCase().trim();
  if (ROLE_MAP.sales.some((k) => role.includes(k))) return "SALES";
  if (ROLE_MAP.admin.some((k) => role.includes(k))) return "ADMIN";
  if (ROLE_MAP.tech.some((k) => role.includes(k))) return "TECH";
  return "OTHER";
}

function mapUserRole(roleRaw: string, department: NexaMappedMember["department"]): UserRole {
  const role = roleRaw.toLowerCase();
  if (department === "SALES") {
    if (role.includes("head")) return UserRole.SALES_HEAD;
    if (role.includes("tele")) return UserRole.TELECALLER;
    return UserRole.SALES_EXECUTIVE;
  }
  if (department === "ADMIN") {
    if (role.includes("hr")) return UserRole.HR_MANAGER;
    if (role.includes("account")) return UserRole.ACCOUNTANT;
    return UserRole.MANAGER;
  }
  if (department === "TECH") {
    if (role.includes("head")) return UserRole.TECH_HEAD;
    return UserRole.TECH_EXECUTIVE;
  }
  return UserRole.MANAGER;
}

function dashboardForDepartment(department: NexaMappedMember["department"]): NexaMappedMember["dashboard"] {
  if (department === "SALES") return "SALES_DASHBOARD";
  if (department === "ADMIN") return "ADMIN_DASHBOARD";
  if (department === "TECH") return "TECH_DASHBOARD";
  return "GENERAL_DASHBOARD";
}

export function parseTeamInput(text: string): NexaParsedMember[] {
  const parts = text
    .split(/\n|,/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: NexaParsedMember[] = [];
  for (const row of parts) {
    const byDivider = row.split(/\s*[–-]\s*|\s*:\s*/).map((s) => s.trim()).filter(Boolean);
    if (byDivider.length >= 2) {
      out.push({ name: byDivider[0]!, roleRaw: byDivider[1]! });
      continue;
    }
    const wordSplit = row.trim().split(/\s+/);
    if (wordSplit.length >= 2) {
      const name = wordSplit[0]!;
      const roleRaw = wordSplit.slice(1).join(" ").trim() || "staff";
      out.push({ name, roleRaw });
      continue;
    }
    out.push({ name: row, roleRaw: "staff" });
  }
  return out;
}

export function mapRoles(parsed: NexaParsedMember[]): NexaMappedMember[] {
  return parsed.map((m) => {
    const department = roleToDepartment(m.roleRaw);
    return {
      name: m.name.trim(),
      roleRaw: m.roleRaw.trim() || "staff",
      department,
      dashboard: dashboardForDepartment(department),
      userRole: mapUserRole(m.roleRaw, department),
    };
  });
}

export function detectUnknownRoles(mapped: NexaMappedMember[]): string[] {
  return mapped.filter((m) => m.department === "OTHER").map((m) => m.roleRaw);
}

export function suggestMissingRoles(team: NexaMappedMember[]): string[] {
  const depts = new Set(team.map((m) => m.department));
  const out: string[] = [];
  if (!depts.has("ADMIN")) out.push("Consider adding an Admin");
  if (!depts.has("SALES")) out.push("No Sales role detected");
  return out;
}

export function buildOnboardingPlan(input: {
  companyName: string;
  industry: "SOLAR" | "CUSTOM";
  team: NexaMappedMember[];
}) {
  const unknownRoles = detectUnknownRoles(input.team);
  const departments = input.team.reduce(
    (acc, row) => {
      if (row.department === "SALES") acc.sales += 1;
      if (row.department === "ADMIN") acc.admin += 1;
      if (row.department === "TECH") acc.tech += 1;
      return acc;
    },
    { sales: 0, admin: 0, tech: 0 },
  );
  return {
    company: {
      name: input.companyName.trim(),
      industry: input.industry,
    },
    employees: input.team,
    departments,
    unknownRoles,
    requiresTech: unknownRoles.length > 0,
    suggestions: suggestMissingRoles(input.team),
  };
}
