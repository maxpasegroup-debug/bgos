import "server-only";

import { LeadStatus, TaskStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { createLogger } from "@/lib/logger";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { prisma } from "@/lib/prisma";
import { taskPriorityFromTitle } from "@/lib/task-engine";

function endOfDayUtc(base: Date, addDays: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + addDays);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function applyLeadTemplate(template: string, lead: { name: string }): string {
  return template.replace(/\{\{name\}\}/g, lead.name);
}

export type LeadAutomationContext = {
  id: string;
  name: string;
  companyId: string;
  assignedTo: string | null;
};

/**
 * Runs automations for `companyId` + `trigger` from DB (industry pack).
 * WhatsApp actions are simulated via ActivityLog (no external send).
 */
export async function runAutomationExecution(
  companyId: string,
  trigger: string,
  context: { lead: LeadAutomationContext },
): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { companyId, trigger },
  });
  if (automations.length === 0) return;

  const log = createLogger("automation");
  const { lead } = context;

  for (const auto of automations) {
    try {
      await executeAutomationRow(auto, lead);
    } catch (e) {
      log.error(`Automation "${auto.name}" (${auto.id}) failed`, e, {
        companyId,
        trigger,
      });
    }
  }
}

export async function executeAutomationRow(
  auto: {
    id: string;
    name: string;
    action: string;
    config: Prisma.JsonValue;
    companyId: string;
  },
  lead: LeadAutomationContext,
): Promise<void> {
  const cfg =
    auto.config && typeof auto.config === "object" && !Array.isArray(auto.config)
      ? (auto.config as Record<string, unknown>)
      : {};

  switch (auto.action) {
    case "SEND_WHATSAPP": {
      if (isPlanLockedToBasic()) return;
      const raw = cfg.message;
      const message =
        typeof raw === "string" ? applyLeadTemplate(raw, lead) : `[Automation] ${auto.name}`;
      await logActivity(prisma, {
        companyId: auto.companyId,
        userId: null,
        type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
        message: `[WhatsApp sim] ${message}`,
        metadata: {
          automationId: auto.id,
          automationName: auto.name,
          leadId: lead.id,
          channel: "whatsapp_simulated",
        },
      });
      return;
    }
    case "CREATE_TASK": {
      const rawTask = cfg.task;
      const title =
        typeof rawTask === "string" ? applyLeadTemplate(rawTask, lead) : `Follow up — ${lead.name}`;
      const days = typeof cfg.days === "number" && Number.isFinite(cfg.days) ? cfg.days : 2;
      const dueDate = endOfDayUtc(new Date(), days);
      await prisma.task.create({
        data: {
          title,
          description: `Automation: ${auto.name}`,
          status: TaskStatus.PENDING,
          leadId: lead.id,
          companyId: lead.companyId,
          userId: lead.assignedTo,
          dueDate,
          priority: taskPriorityFromTitle(title),
        },
      });
      await logActivity(prisma, {
        companyId: auto.companyId,
        userId: null,
        type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
        message: `Task created by automation: ${title}`,
        metadata: {
          automationId: auto.id,
          automationName: auto.name,
          leadId: lead.id,
          action: "CREATE_TASK",
        },
      });
      return;
    }
    default:
      await logActivity(prisma, {
        companyId: auto.companyId,
        userId: null,
        type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
        message: `Automation "${auto.name}" — action "${auto.action}" (no handler)`,
        metadata: { automationId: auto.id, leadId: lead.id },
      });
  }
}

/** Fires `STAGE_ENTERED` automations whose `config.stage` matches the new status. */
export async function runStageEnteredAutomations(
  companyId: string,
  stage: LeadStatus,
  lead: LeadAutomationContext,
): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: { companyId, trigger: "STAGE_ENTERED" },
  });
  if (automations.length === 0) return;

  const log = createLogger("automation");
  for (const auto of automations) {
    const cfg =
      auto.config && typeof auto.config === "object" && !Array.isArray(auto.config)
        ? (auto.config as Record<string, unknown>)
        : {};
    if (cfg.stage !== stage) continue;
    try {
      await executeAutomationRow(auto, lead);
    } catch (e) {
      log.error(`Automation "${auto.name}" (${auto.id}) failed`, e, {
        companyId,
        trigger: "STAGE_ENTERED",
      });
    }
  }
}
