import "server-only";
import { prisma } from "@/lib/prisma";

export type DashboardRole = "Sales" | "Technician" | "Accounts" | "Manager";
export type DashboardStatus = "READY" | "PENDING_BUILD" | "IN_PROGRESS" | "LIVE";
export type NexaOnboardingSource = "SALES" | "FRANCHISE" | "DIRECT";

export async function startNexaOnboarding(input: {
  userId: string;
  source: NexaOnboardingSource;
  leadId?: string | null;
  partnerId?: string | null;
}) {
  const existing = await prisma.onboardingSession.findFirst({
    where: {
      createdByUserId: input.userId,
      source: input.source,
      status: { in: ["draft", "in_progress", "ready"] },
      ...(input.leadId ? { leadId: input.leadId } : {}),
    } as any,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return { sessionId: existing.id, resumed: true as const };

  const created = await prisma.onboardingSession.create({
    data: {
      createdByUserId: input.userId,
      source: input.source,
      leadId: input.leadId ?? null,
      partnerId: input.partnerId ?? null,
      status: "in_progress",
      currentStep: input.source === "SALES" ? "select_lead" : "industry",
      rawTeamInput: null,
      parsedTeam: {} as object,
      unknownRoles: [] as object,
      data: {
        source: input.source,
        leadId: input.leadId ?? null,
        partnerId: input.partnerId ?? null,
      } as object,
    } as any,
    select: { id: true },
  });
  return { sessionId: created.id, resumed: false as const };
}

export const dashboardLibrary: Array<{ role: DashboardRole; keywords: string[] }> = [
  { role: "Sales", keywords: ["lead", "sales", "conversion"] },
  { role: "Technician", keywords: ["installation", "service"] },
  { role: "Accounts", keywords: ["payment", "invoice"] },
  { role: "Manager", keywords: ["report", "team"] },
];

export type TeamEntry = {
  name: string;
  role: string;
  mapped: boolean;
  mappedDashboard: DashboardRole | null;
  status: DashboardStatus;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function mapOperationsToDashboards(operations: string[]): DashboardRole[] {
  const chosen = new Set<DashboardRole>();
  const joined = operations.map(normalize);
  for (const op of joined) {
    for (const entry of dashboardLibrary) {
      if (entry.keywords.some((k) => op.includes(k))) {
        chosen.add(entry.role);
      }
    }
  }
  if (chosen.size === 0) chosen.add("Manager");
  return [...chosen];
}

export function mapTeamEntries(teamRaw: Array<{ name: string; role: string }>): TeamEntry[] {
  return teamRaw.map((row) => {
    const roleText = normalize(row.role);
    let mappedDashboard: DashboardRole | null = null;
    for (const entry of dashboardLibrary) {
      if (entry.keywords.some((k) => roleText.includes(k)) || roleText.includes(entry.role.toLowerCase())) {
        mappedDashboard = entry.role;
        break;
      }
    }
    const mapped = Boolean(mappedDashboard);
    return {
      name: row.name.trim(),
      role: row.role.trim(),
      mapped,
      mappedDashboard,
      status: mapped ? "READY" : "PENDING_BUILD",
    };
  });
}

export function deriveArchitectureSummary(input: {
  requiredDashboards: DashboardRole[];
  team: TeamEntry[];
}) {
  const available = new Set<DashboardRole>(input.requiredDashboards);
  const inDevelopment = new Set<string>();
  for (const t of input.team) {
    if (t.mappedDashboard) available.add(t.mappedDashboard);
    if (!t.mapped) inDevelopment.add(t.role);
  }
  return {
    availableDashboards: [...available],
    inDevelopmentDashboards: [...inDevelopment],
    team: input.team,
    bossDashboard: ["Leads", "Revenue", "Team overview"],
  };
}
