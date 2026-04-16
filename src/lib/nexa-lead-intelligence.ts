import "server-only";

import { LeadResponseStatus, LeadStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyLeadStatusChange } from "@/lib/lead-status-service";

type LeadSignalInput = {
  id: string;
  companyId: string;
  assignedTo: string | null;
  status: LeadStatus;
  currentStage: string | null;
  lastActivityAt: Date | null;
  nextActionDue: Date | null;
  activityCount: number;
  responseStatus: LeadResponseStatus;
  confidenceScore: number;
  internalCallStatus: string | null;
  iceconnectMetroStage: string | null;
  internalSalesStage: string | null;
  updatedAt: Date;
};

export type LeadDecision = {
  leadId: string;
  confidenceScore: number;
  suggestion: string;
  priority: boolean;
  nextStatus?: LeadStatus;
  actionType: "MOVE" | "REMINDER" | "SUGGESTION" | "COOLING" | "LOST";
  reason: string;
  heat: "HOT" | "WARM" | "COLD";
  urgencyMessage?: string;
  followUpSequenceDays?: number[];
  atRisk?: boolean;
};

function hoursSince(ts: Date | null, now = Date.now()): number {
  if (!ts) return Number.POSITIVE_INFINITY;
  return (now - ts.getTime()) / 36e5;
}

function progressionHint(lead: LeadSignalInput): LeadStatus | null {
  if (lead.status === LeadStatus.NEW) {
    if (lead.internalCallStatus === "CALLED" || lead.activityCount > 0) return LeadStatus.CONTACTED;
  }
  if (lead.status === LeadStatus.CONTACTED) {
    if (lead.iceconnectMetroStage === "DEMO_DONE" || lead.internalSalesStage === "DEMO_ORIENTATION")
      return LeadStatus.SITE_VISIT_SCHEDULED;
  }
  if (lead.status === LeadStatus.SITE_VISIT_COMPLETED || lead.status === LeadStatus.SITE_VISIT_SCHEDULED) {
    if (lead.activityCount > 1) return LeadStatus.NEGOTIATION;
  }
  if (lead.status === LeadStatus.NEGOTIATION) {
    if (lead.confidenceScore >= 70) return LeadStatus.PROPOSAL_WON;
  }
  if (lead.status === LeadStatus.PROPOSAL_WON) {
    if (lead.iceconnectMetroStage === "SUBSCRIPTION") return LeadStatus.WON;
  }
  return null;
}

function leadHeat(lead: LeadSignalInput): "HOT" | "WARM" | "COLD" {
  const inactiveHrs = hoursSince(lead.lastActivityAt ?? lead.updatedAt);
  if (lead.confidenceScore >= 75 && inactiveHrs <= 24) return "HOT";
  if (lead.confidenceScore > 60 && inactiveHrs <= 72) return "WARM";
  return "COLD";
}

function urgencyTrigger(lead: LeadSignalInput): string | undefined {
  const inactiveHrs = hoursSince(lead.lastActivityAt ?? lead.updatedAt);
  const warm = lead.confidenceScore > 60 && inactiveHrs <= 24 * 3;
  if (!warm) return undefined;
  const options = [
    "Limited offer ends today",
    "Only few slots left",
    "Activation benefit expires soon",
  ];
  const idx = Math.max(0, Math.min(2, Math.floor(inactiveHrs / 24)));
  return options[idx];
}

async function ensureFollowUpSequenceTasks(input: {
  companyId: string;
  leadId: string;
  userId: string;
  leadName: string;
  baseAt?: Date;
}) {
  const base = input.baseAt ?? new Date();
  const plan = [
    { day: 1, title: `Nexa Day 1: Friendly reminder — ${input.leadName}`, priority: 2 },
    { day: 2, title: `Nexa Day 2: Value reinforcement — ${input.leadName}`, priority: 2 },
    { day: 3, title: `Nexa Day 3: Urgency message — ${input.leadName}`, priority: 3 },
    { day: 5, title: `Nexa Day 5: Final push — ${input.leadName}`, priority: 3 },
  ];
  const existing = await prisma.task.findMany({
    where: {
      companyId: input.companyId,
      leadId: input.leadId,
      status: TaskStatus.PENDING,
      title: { startsWith: "Nexa Day " },
    },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((x) => x.title));
  for (const item of plan) {
    if (existingTitles.has(item.title)) continue;
    await prisma.task.create({
      data: {
        companyId: input.companyId,
        leadId: input.leadId,
        userId: input.userId,
        title: item.title,
        description: "Nexa auto-closing cadence. Keep message contextual and non-spammy.",
        status: TaskStatus.PENDING,
        priority: item.priority,
        dueDate: new Date(base.getTime() + item.day * 24 * 36e5),
      },
    });
  }
}

export function evaluateLead(lead: LeadSignalInput): LeadDecision {
  const now = Date.now();
  const inactiveHrs = hoursSince(lead.lastActivityAt ?? lead.updatedAt, now);
  const nextProgress = progressionHint(lead);
  const heat = leadHeat(lead);
  const urgency = urgencyTrigger(lead);
  const isAutoCloseTarget =
    (lead.status === LeadStatus.NEGOTIATION || lead.status === LeadStatus.PROPOSAL_WON) &&
    lead.confidenceScore > 60 &&
    inactiveHrs <= 24 * 3;

  if (
    lead.status === LeadStatus.PROPOSAL_WON &&
    (lead.iceconnectMetroStage === "PAYMENT_DONE" || lead.iceconnectMetroStage === "SUBSCRIPTION")
  ) {
    return {
      leadId: lead.id,
      confidenceScore: Math.max(95, lead.confidenceScore),
      suggestion: "Payment completed — closing deal now.",
      priority: true,
      nextStatus: LeadStatus.WON,
      actionType: "MOVE",
      reason: "payment_completed_autoclose",
      heat: "HOT",
      urgencyMessage: "Complete your setup",
      followUpSequenceDays: [],
    };
  }

  if (isAutoCloseTarget) {
    const actionText =
      lead.status === LeadStatus.PROPOSAL_WON
        ? "Push onboarding link"
        : lead.confidenceScore >= 80
          ? "Call now — high intent"
          : "Send pricing reminder";
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: `Nexa suggests next step: ${actionText}.`,
      priority: true,
      actionType: "SUGGESTION",
      reason: "auto_close_target",
      heat,
      urgencyMessage: urgency,
      followUpSequenceDays: [1, 2, 3, 5],
      atRisk: inactiveHrs >= 24 * 2,
    };
  }

  if (inactiveHrs >= 24 && inactiveHrs < 48) {
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: "No activity for 24h — follow up now.",
      priority: true,
      actionType: "REMINDER",
      reason: "inactive_24h",
      heat,
    };
  }

  if ((lead.responseStatus === LeadResponseStatus.SILENT && inactiveHrs >= 48) || inactiveHrs >= 48) {
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: "Lead silent for 48h — moving to follow-up.",
      priority: true,
      nextStatus: LeadStatus.NEGOTIATION,
      actionType: "MOVE",
      reason: "silent_48h",
      heat: "WARM",
      atRisk: true,
    };
  }

  if (inactiveHrs >= 24 * 5 && inactiveHrs < 24 * 10) {
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: "Lead cooling due to inactivity.",
      priority: false,
      actionType: "COOLING",
      reason: "cooling_5d",
      heat: "COLD",
      atRisk: true,
    };
  }

  if (inactiveHrs >= 24 * 10) {
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: "Inactive for 10 days — marked lost.",
      priority: false,
      nextStatus: LeadStatus.LOST,
      actionType: "LOST",
      reason: "inactive_10d",
      heat: "COLD",
      atRisk: true,
    };
  }

  if (nextProgress && lead.confidenceScore > 80 && lead.activityCount > 3) {
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: "Strong confidence and activity — move forward.",
      priority: true,
      nextStatus: nextProgress,
      actionType: "MOVE",
      reason: "confidence_progression",
      heat: "HOT",
    };
  }

  if (lead.nextActionDue && lead.nextActionDue.getTime() < now) {
    return {
      leadId: lead.id,
      confidenceScore: lead.confidenceScore,
      suggestion: "Action due now — engage lead.",
      priority: true,
      actionType: "SUGGESTION",
      reason: "action_due",
      heat,
      urgencyMessage: urgency,
    };
  }

  return {
    leadId: lead.id,
    confidenceScore: lead.confidenceScore,
    suggestion: "Maintain cadence and track response.",
    priority: false,
    actionType: "SUGGESTION",
    reason: "steady",
    heat,
  };
}

export async function runNexaLeadAutoMovement(input: {
  companyId: string;
  actorUserId: string;
  previewOnly?: boolean;
  onlyAssignedTo?: string;
}) {
  const rows = await prisma.lead.findMany({
    where: {
      companyId: input.companyId,
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      ...(input.onlyAssignedTo ? { assignedTo: input.onlyAssignedTo } : {}),
    },
    select: {
      id: true,
      companyId: true,
      assignedTo: true,
      status: true,
      currentStage: true,
      lastActivityAt: true,
      nextActionDue: true,
      activityCount: true,
      responseStatus: true,
      confidenceScore: true,
      internalCallStatus: true,
      iceconnectMetroStage: true,
      internalSalesStage: true,
      updatedAt: true,
      name: true,
    },
    take: 300,
    orderBy: { updatedAt: "desc" },
  });

  const decisions = rows.map((r) => ({ lead: r, decision: evaluateLead(r) }));
  const preview = decisions
    .filter((d) => d.decision.priority || d.decision.nextStatus != null)
    .slice(0, 40)
    .map((d) => ({
      leadName: d.lead.name,
      ...d.decision,
    }));

  if (input.previewOnly) {
    return { preview, moved: [] as Array<{ leadId: string; status: LeadStatus; reason: string }> };
  }

  const moved: Array<{ leadId: string; status: LeadStatus; reason: string }> = [];
  for (const row of decisions) {
    const lead = row.lead;
    const decision = row.decision;

    if (decision.nextStatus && decision.nextStatus !== lead.status) {
      const result = await applyLeadStatusChange({
        actorId: input.actorUserId,
        companyId: input.companyId,
        leadId: lead.id,
        nextStatus: decision.nextStatus,
      });
      if (result.ok) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            nexaMovedAt: new Date(),
            nexaMovedReason: decision.atRisk ? `${decision.reason}:at_risk` : decision.reason,
            currentStage: result.lead.status,
            nexaPriority: decision.priority,
            responseStatus:
              decision.actionType === "COOLING"
                ? LeadResponseStatus.COOLING
                : decision.actionType === "REMINDER"
                  ? LeadResponseStatus.SILENT
                  : undefined,
            nextActionDue: new Date(Date.now() + 24 * 36e5),
          },
        });
        await prisma.nexaAction.create({
          data: {
            companyId: input.companyId,
            actorUserId: input.actorUserId,
            type: "AUTO_CLOSE",
            event: "lead_moved",
            target: lead.id,
            status: "DONE",
            message: decision.suggestion,
            metadata: {
              reason: decision.reason,
              heat: decision.heat,
              confidence: decision.confidenceScore,
              nextStatus: decision.nextStatus,
            },
          },
        });
        moved.push({ leadId: lead.id, status: decision.nextStatus, reason: decision.reason });

        if (decision.nextStatus === LeadStatus.NEGOTIATION && lead.assignedTo) {
          await prisma.task.create({
            data: {
              companyId: input.companyId,
              userId: lead.assignedTo,
              leadId: lead.id,
              title: "Nexa follow-up: call and send message",
              description: "Lead moved to follow-up by Nexa. Use script and update response.",
              status: TaskStatus.PENDING,
              priority: 3,
              dueDate: new Date(Date.now() + 4 * 36e5),
            },
          });
          await ensureFollowUpSequenceTasks({
            companyId: input.companyId,
            leadId: lead.id,
            userId: lead.assignedTo,
            leadName: lead.name,
          });
        }
      }
      continue;
    }

    if (decision.actionType === "REMINDER" && lead.assignedTo) {
      await prisma.task.create({
        data: {
          companyId: input.companyId,
          userId: lead.assignedTo,
          leadId: lead.id,
          title: "Nexa reminder: lead requires activity",
          description: "No lead activity in last 24 hours. Take next action now.",
          status: TaskStatus.PENDING,
          priority: 2,
          dueDate: new Date(Date.now() + 2 * 36e5),
        },
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nexaPriority: true,
          responseStatus: LeadResponseStatus.SILENT,
          nextActionDue: new Date(Date.now() + 24 * 36e5),
        },
      });
      await prisma.nexaAction.create({
        data: {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          type: "AUTO_CLOSE",
          event: "reminder",
          target: lead.id,
          status: "DONE",
          message: decision.suggestion,
          metadata: { reason: decision.reason, heat: decision.heat },
        },
      });
    }

    if (decision.reason === "auto_close_target" && lead.assignedTo) {
      if (decision.urgencyMessage) {
        await prisma.task.create({
          data: {
            companyId: input.companyId,
            userId: lead.assignedTo,
            leadId: lead.id,
            title: `Nexa urgency: ${decision.urgencyMessage}`,
            description: "Use this as contextual nudge. Keep tone subtle and helpful.",
            status: TaskStatus.PENDING,
            priority: decision.heat === "HOT" ? 3 : 2,
            dueDate: new Date(Date.now() + 2 * 36e5),
          },
        });
      }
      await ensureFollowUpSequenceTasks({
        companyId: input.companyId,
        leadId: lead.id,
        userId: lead.assignedTo,
        leadName: lead.name,
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nexaPriority: decision.heat !== "COLD",
          nexaMovedReason: decision.atRisk ? "auto_close_target:at_risk" : "auto_close_target",
          nextActionDue: new Date(Date.now() + (decision.heat === "HOT" ? 4 : 12) * 36e5),
        },
      });
      await prisma.nexaAction.create({
        data: {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          type: "AUTO_CLOSE",
          event: "assist_suggestion",
          target: lead.id,
          status: "DONE",
          message: decision.suggestion,
          metadata: {
            urgencyMessage: decision.urgencyMessage ?? null,
            heat: decision.heat,
            sequenceDays: decision.followUpSequenceDays ?? [],
          },
        },
      });
    }

    if (decision.actionType === "COOLING") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          responseStatus: LeadResponseStatus.COOLING,
          nexaPriority: false,
          nexaMovedAt: new Date(),
          nexaMovedReason: decision.reason,
        },
      });
    }

    if (decision.atRisk) {
      const company = await prisma.company.findUnique({
        where: { id: input.companyId },
        select: { ownerId: true },
      });
      if (company?.ownerId) {
        await prisma.task.create({
          data: {
            companyId: input.companyId,
            userId: company.ownerId,
            leadId: lead.id,
            title: `Nexa escalation: Lead at risk — ${lead.name}`,
            description: "Executive inactivity detected. Review and intervene.",
            status: TaskStatus.PENDING,
            priority: 3,
            dueDate: new Date(Date.now() + 1 * 36e5),
          },
        });
      }
      await prisma.nexaAction.create({
        data: {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          type: "AUTO_CLOSE",
          event: "boss_escalation",
          target: lead.id,
          status: "DONE",
          message: "Lead marked at risk and escalated to boss.",
          metadata: {
            reason: decision.reason,
            heat: decision.heat,
          },
        },
      });
    }
  }

  const topSuggestion = preview[0]?.suggestion ?? "Follow up with priority leads today.";
  return { preview, moved, topSuggestion };
}
