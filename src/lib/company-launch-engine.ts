import { UserRole, type CompanyBusinessType, type CompanyPlan } from "@prisma/client";
import * as XLSX from "xlsx";

export type LaunchIndustry = "SOLAR" | "CUSTOM";
export type TeamDept = "SALES" | "ADMIN" | "TECH" | "OTHER";

export type ParsedTeamMember = {
  name: string;
  roleLabel: string;
  department: TeamDept;
  userRole: UserRole;
  email?: string;
};

const SALES_ROLE_WORDS = ["sales", "telecaller", "bd", "business development", "lead"];
const ADMIN_ROLE_WORDS = ["admin", "accounts", "accountant", "hr", "operations", "ops", "manager"];
const TECH_ROLE_WORDS = ["tech", "engineer", "installation", "service", "support", "developer", "it"];

function classifyDepartment(roleLabel: string): TeamDept {
  const r = roleLabel.trim().toLowerCase();
  if (!r) return "OTHER";
  if (SALES_ROLE_WORDS.some((k) => r.includes(k))) return "SALES";
  if (TECH_ROLE_WORDS.some((k) => r.includes(k))) return "TECH";
  if (ADMIN_ROLE_WORDS.some((k) => r.includes(k))) return "ADMIN";
  return "OTHER";
}

function roleForDepartment(department: TeamDept, roleLabel: string): UserRole {
  const r = roleLabel.toLowerCase();
  if (department === "TECH") {
    if (r.includes("head")) return UserRole.TECH_HEAD;
    return UserRole.TECH_EXECUTIVE;
  }
  if (department === "SALES") {
    if (r.includes("head")) return UserRole.SALES_HEAD;
    if (r.includes("tele")) return UserRole.TELECALLER;
    return UserRole.SALES_EXECUTIVE;
  }
  if (department === "ADMIN") {
    if (r.includes("account")) return UserRole.ACCOUNTANT;
    if (r.includes("hr")) return UserRole.HR_MANAGER;
    return UserRole.MANAGER;
  }
  return UserRole.MANAGER;
}

export function parseTeamInput(rawTeamInput: string): {
  parsedTeam: ParsedTeamMember[];
  unknownRoles: string[];
} {
  const parts = rawTeamInput
    .split(/\n|,/)
    .map((p) => p.trim())
    .filter(Boolean);
  const parsedTeam: ParsedTeamMember[] = [];
  const unknownRoles: string[] = [];

  for (const row of parts) {
    const tokens = row.split(/\s*[–-]\s*|\s*:\s*/).map((t) => t.trim());
    const name = tokens[0] ?? "";
    const roleLabel = tokens[1] ?? "";
    if (!name) continue;
    const department = classifyDepartment(roleLabel);
    if (department === "OTHER" && roleLabel) unknownRoles.push(roleLabel);
    parsedTeam.push({
      name,
      roleLabel: roleLabel || "Team Member",
      department,
      userRole: roleForDepartment(department, roleLabel),
    });
  }
  return { parsedTeam, unknownRoles };
}

export function industryToBusinessType(industry: LaunchIndustry): CompanyBusinessType {
  return industry === "CUSTOM" ? "CUSTOM" : "SOLAR";
}

export function industryToPlan(industry: LaunchIndustry): CompanyPlan {
  return industry === "CUSTOM" ? "PRO" : "BASIC";
}

export function generatePassword(companyName: string, employeeName: string): string {
  const company = companyName.trim().replace(/\s+/g, "").slice(0, 3).toUpperCase() || "BGO";
  const emp = employeeName.trim().replace(/\s+/g, "").slice(0, 2).toUpperCase() || "US";
  const rand = Math.random().toString(36).slice(-4);
  return `${company}-${emp}@${rand}`;
}

function sanitizeSlug(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

export function generateEmail(companyName: string, employeeName: string): string {
  const c = sanitizeSlug(companyName) || "company";
  const e = sanitizeSlug(employeeName) || "user";
  return `${e}@${c}.bgos.local`;
}

export type LaunchCredential = {
  name: string;
  role: string;
  email: string;
  password: string;
  loginUrl: string;
};

export function credentialsWorkbookBase64(rows: LaunchCredential[]): string {
  const sheetRows = rows.map((r) => ({
    Name: r.name,
    Role: r.role,
    Email: r.email,
    Password: r.password,
    "Login URL": r.loginUrl,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Credentials");
  const arr = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return arr.toString("base64");
}
