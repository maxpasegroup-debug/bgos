export type OnboardingSubmissionRole = {
  department: string;
  roleName: string;
  count: number;
  features: string[];
};

export type OnboardingSubmissionEmployee = {
  roleName: string;
  name: string;
  email: string;
  phone: string;
};

export type OnboardingSubmissionData = {
  businessDescription: string;
  teamSize: number;
  departments: string[];
  roles: OnboardingSubmissionRole[];
  employees: OnboardingSubmissionEmployee[];
  bossDashboardFeatures: string[];
};

export function estimateBuildDays(data: Pick<OnboardingSubmissionData, "roles" | "employees">): string {
  const dashboardCount = data.roles.length + 1;
  if (dashboardCount <= 3 && data.employees.length <= 5) return "2-3 business days";
  if (dashboardCount <= 6) return "3-5 business days";
  return "5-7 business days";
}

export function generateSdeBrief(
  data: OnboardingSubmissionData,
  company: { name: string; industry: string },
): string {
  const lines: string[] = [
    "-------------------------------",
    "DASHBOARD BUILD REQUEST",
    "-------------------------------",
    `Company: ${company.name}`,
    `Industry: ${company.industry}`,
    `Team Size: ${data.teamSize} employees`,
    `Departments: ${data.departments.join(", ")}`,
    "",
    "BUSINESS OVERVIEW:",
    data.businessDescription,
    "",
    "DASHBOARDS REQUIRED:",
    "------------------",
    "1. BOSS DASHBOARD",
    `   Needs: ${data.bossDashboardFeatures.join(", ")}`,
    "",
  ];

  data.roles.forEach((role, index) => {
    lines.push(`${index + 2}. ${role.roleName.toUpperCase()} DASHBOARD`);
    lines.push(`   Department: ${role.department}`);
    lines.push(`   Users: ${role.count} person(s)`);
    lines.push(`   Needs: ${role.features.join(", ")}`);
    lines.push("");
  });

  if (data.employees.length > 0) {
    lines.push("EMPLOYEES TO CREATE:");
    lines.push("------------------");
    data.employees.forEach((employee) => {
      lines.push(`${employee.roleName}: ${employee.name} | ${employee.email} | ${employee.phone}`);
    });
    lines.push("");
  }

  lines.push(`Total Dashboards: ${data.roles.length + 1}`);
  lines.push(`Estimated Build Time: ${estimateBuildDays(data)}`);
  lines.push(`Submitted: ${new Date().toLocaleDateString("en-IN")}`);
  lines.push("-------------------------------");

  return lines.join("\n");
}
