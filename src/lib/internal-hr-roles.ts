import { UserRole } from "@prisma/client";

/** Allowed job roles when inviting employees to a BGOS Internal (`internalSalesOrg`) company. */
export const INTERNAL_ORG_EMPLOYEE_ROLES: readonly UserRole[] = [
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
] as const;

export const INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.MANAGER, label: "Sales Manager" },
  { value: UserRole.SALES_EXECUTIVE, label: "Sales Executive" },
  { value: UserRole.TECH_HEAD, label: "Tech Head" },
  { value: UserRole.TECH_EXECUTIVE, label: "Tech Executive" },
];

/** Default solar / field employee roles (non–internal-sales org). */
export const SOLAR_FIELD_EMPLOYEE_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.SALES_HEAD, label: "Sales Head" },
  { value: UserRole.SALES_EXECUTIVE, label: "Sales Executive" },
  { value: UserRole.TELECALLER, label: "Telecaller" },
  { value: UserRole.OPERATIONS_HEAD, label: "Operations Head" },
  { value: UserRole.SITE_ENGINEER, label: "Engineer" },
  { value: UserRole.INSTALLATION_TEAM, label: "Installer" },
  { value: UserRole.ACCOUNTANT, label: "Accounts" },
  { value: UserRole.HR_MANAGER, label: "HR Manager" },
];

export function isInternalOrgEmployeeRole(role: UserRole): boolean {
  return (INTERNAL_ORG_EMPLOYEE_ROLES as readonly UserRole[]).includes(role);
}

/** Solar / tenant companies: field roles plus manager + tech (boss team management). */
const NON_INTERNAL_ASSIGNABLE = new Set<UserRole>([
  ...SOLAR_FIELD_EMPLOYEE_ROLE_OPTIONS.map((o) => o.value),
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
]);

export function isAllowedHrEmployeeRole(internalSalesOrg: boolean, role: UserRole): boolean {
  if (internalSalesOrg) {
    return isInternalOrgEmployeeRole(role);
  }
  return NON_INTERNAL_ASSIGNABLE.has(role);
}
