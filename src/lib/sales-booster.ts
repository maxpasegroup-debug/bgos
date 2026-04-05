import "server-only";

import { CompanyPlan, LeadStatus, TaskStatus } from "@prisma/client";
import { forwardLeadStatuses, leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

export type SalesBoosterBasicPayload = {
  plan: "BASIC";
  featuresUnlocked: false;
  companyName: string;
};

export type SalesBoosterProPayload = {
  plan: "PRO";
  featuresUnlocked: true;
  companyName: string;
  autoFollowUps: Array<{
    leadId: string;
    leadName: string;
    reason: string;
    channel: "WhatsApp";
    nextAction: string;
    trigger: "overdue_task" | "stale_lead" | "due_within_24h";
  }>;
  prioritizedLeads: Array<{
    leadId: string;
    leadName: string;
    score: number;
    reason: string;
    value: number | null;
    currentStatusLabel: string;
  }>;
  statusSuggestions: Array<{
    leadId: string;
    leadName: string;
    currentStatusLabel: string;
    suggestedStatusLabel: string;
    rationale: string;
  }>;
  whatsappSimulation: Array<{
    id: string;
    leadName: string;
    phoneMasked: string;
    preview: string;
    state: "queued" | "sent_simulated";
    at: string;
  }>;
};

export type SalesBoosterPayload = SalesBoosterBasicPayload | SalesBoosterProPayload;

function stageWeight(status: LeadStatus): number {
  const w: Partial<Record<LeadStatus, number>> = {
    [LeadStatus.NEGOTIATION]: 45,
    [LeadStatus.PROPOSAL_SENT]: 38,
    [LeadStatus.SITE_VISIT_COMPLETED]: 32,
    [LeadStatus.SITE_VISIT_SCHEDULED]: 28,
    [LeadStatus.QUALIFIED]: 22,
    [LeadStatus.CONTACTED]: 15,
    [LeadStatus.NEW]: 10,
  };
  return w[status] ?? 0;
}

function leadScore(input: {
  status: LeadStatus;
  value: number | null;
  hasOverdueTask: boolean;
  staleHours: number;
}): { score: number; reason: string } {
  let score =
    stageWeight(input.status) + Math.min(25, Math.round((input.value ?? 0) / 80000));
  const reasons: string[] = [];
  if (input.hasOverdueTask) {
    score += 22;
    reasons.push("overdue task");
  }
  if (input.staleHours >= 48 && (input.status === LeadStatus.NEW || input.status === LeadStatus.CONTACTED)) {
    score += 18;
    reasons.push("stale new/contacted");
  }
  if (
    input.status === LeadStatus.NEGOTIATION ||
    input.status === LeadStatus.PROPOSAL_SENT
  ) {
    reasons.push("late pipeline");
  }
  score = Math.min(100, Math.round(score));
  const reason = reasons.length > 0 ? reasons.join(" · ") : "pipeline value";
  return { score, reason };
}

export async function buildSalesBoosterPayload(
  companyId: string,
  sessionCompanyPlan: CompanyPlan,
): Promise<SalesBoosterPayload> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, name: true },
  });

  if (!company) {
    return {
      plan: "BASIC",
      featuresUnlocked: false,
      companyName: "Company",
    };
  }

  const entitled =
    sessionCompanyPlan === CompanyPlan.PRO && company.plan === CompanyPlan.PRO;

  if (!entitled) {
    return {
      plan: "BASIC",
      featuresUnlocked: false,
      companyName: company.name,
    };
  }

  const now = Date.now();

  const openLeads = await prisma.lead.findMany({
    where: {
      companyId,
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
    },
    take: 60,
    orderBy: { createdAt: "desc" },
    include: {
      tasks: {
        where: { status: TaskStatus.PENDING },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  const scored = openLeads.map((lead) => {
    const pending = lead.tasks;
    const overdue = pending.some(
      (t) => t.dueDate !== null && t.dueDate.getTime() < now,
    );
    const staleHours = (now - lead.createdAt.getTime()) / (60 * 60 * 1000);
    const { score, reason } = leadScore({
      status: lead.status,
      value: lead.value,
      hasOverdueTask: overdue,
      staleHours,
    });
    return { lead, score, reason, overdue, staleHours };
  });

  scored.sort((a, b) => b.score - a.score);

  const prioritizedLeads = scored.slice(0, 5).map((s) => ({
    leadId: s.lead.id,
    leadName: s.lead.name,
    score: s.score,
    reason: s.reason,
    value: s.lead.value,
    currentStatusLabel: leadStatusLabel(s.lead.status),
  }));

  const autoFollowUps: SalesBoosterProPayload["autoFollowUps"] = [];
  const seen = new Set<string>();

  for (const s of scored) {
    if (autoFollowUps.length >= 6) break;
    const { lead } = s;
    if (seen.has(lead.id)) continue;
    if (s.overdue) {
      seen.add(lead.id);
      autoFollowUps.push({
        leadId: lead.id,
        leadName: lead.name,
        reason: "Pending task is past due",
        channel: "WhatsApp",
        trigger: "overdue_task",
        nextAction: `Send WhatsApp reminder + log outcome in CRM`,
      });
      continue;
    }
    if (
      (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED) &&
      s.staleHours >= 36
    ) {
      seen.add(lead.id);
      autoFollowUps.push({
        leadId: lead.id,
        leadName: lead.name,
        reason: "No movement in 36h+",
        channel: "WhatsApp",
        trigger: "stale_lead",
        nextAction: `Auto follow-up sequence: intro ping → value prop`,
      });
    }
  }

  for (const t of await prisma.task.findMany({
    where: {
      status: TaskStatus.PENDING,
      dueDate: { lte: new Date(now + 24 * 60 * 60 * 1000) },
      lead: { companyId },
    },
    take: 8,
    include: { lead: true },
  })) {
    if (!t.lead || seen.has(t.lead.id) || autoFollowUps.length >= 6) continue;
    if (
      t.lead.status === LeadStatus.WON ||
      t.lead.status === LeadStatus.LOST
    ) {
      continue;
    }
    seen.add(t.lead.id);
    autoFollowUps.push({
      leadId: t.lead.id,
      leadName: t.lead.name,
      reason: "Task due within 24h",
      channel: "WhatsApp",
      trigger: "due_within_24h",
      nextAction: `Pre-due WhatsApp check-in (simulated automation)`,
    });
  }

  const statusSuggestions: SalesBoosterProPayload["statusSuggestions"] = [];
  for (const s of scored.slice(0, 8)) {
    const next = forwardLeadStatuses(s.lead.status)[0];
    if (!next) continue;
    statusSuggestions.push({
      leadId: s.lead.id,
      leadName: s.lead.name,
      currentStatusLabel: leadStatusLabel(s.lead.status),
      suggestedStatusLabel: leadStatusLabel(next),
      rationale: `Move forward to keep pipeline velocity; next step is ${leadStatusLabel(next)}.`,
    });
  }

  const waSource = scored.slice(0, 4);
  const whatsappSimulation: SalesBoosterProPayload["whatsappSimulation"] = waSource.map(
    (s, i) => {
      const phone = s.lead.phone.replace(/\D/g, "");
      const last4 = phone.length >= 4 ? phone.slice(-4) : "••••";
      const first = s.lead.name.split(/\s+/)[0] ?? s.lead.name;
      return {
        id: `wa-sim-${s.lead.id}-${i}`,
        leadName: s.lead.name,
        phoneMasked: `***${last4}`,
        preview: `Hi ${first} — quick update on your ICECONNECT solar quote. Can we slot 10 min today?`,
        state: i === 0 ? ("sent_simulated" as const) : ("queued" as const),
        at: new Date(now - i * 90_000).toISOString(),
      };
    },
  );

  return {
    plan: "PRO",
    featuresUnlocked: true,
    companyName: company.name,
    autoFollowUps,
    prioritizedLeads,
    statusSuggestions: statusSuggestions.slice(0, 6),
    whatsappSimulation,
  };
}
