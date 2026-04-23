export function getRoleDisplayName(role: string): string {
  const map: Record<string, string> = {
    BDM: "Micro Franchise Partner",
    ADMIN: "Boss",
    MANAGER: "Manager",
    TECH_EXECUTIVE: "Software Dev Executive",
    TECH_HEAD: "SDE Lead",
  };
  return map[role] ?? role;
}

export function getDashboardTitle(role: string): string {
  const map: Record<string, string> = {
    BDM: "Franchise Dashboard",
    ADMIN: "Command Center",
    MANAGER: "Manager Dashboard",
    TECH_EXECUTIVE: "SDE Workspace",
    TECH_HEAD: "SDE Lead Workspace",
  };
  return map[role] ?? "Dashboard";
}

export function getTeamLabel(role: string): string {
  const map: Record<string, string> = {
    BDM: "Franchise Network",
  };
  return map[role] ?? "Team";
}
