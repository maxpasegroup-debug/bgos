import type { LeadStatus, TaskStatus } from "@prisma/client";
import { computeTaskOverdue } from "@/lib/task-engine";
import { leadStatusLabel } from "@/lib/lead-pipeline";

export type TaskWithRelations = {
  id: string;
  title: string;
  status: TaskStatus;
  userId: string | null;
  leadId: string | null;
  companyId: string;
  priority: number;
  dueDate: Date | null;
  createdAt: Date;
  user: { id: string; name: string; email: string } | null;
  lead: {
    id: string;
    name: string;
    status: LeadStatus;
    companyId: string;
  } | null;
};

export function serializeTask(task: TaskWithRelations) {
  const overdue = computeTaskOverdue(task);
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    userId: task.userId,
    leadId: task.leadId,
    companyId: task.companyId,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    overdue,
    user: task.user,
    lead: task.lead
      ? {
          id: task.lead.id,
          name: task.lead.name,
          status: task.lead.status,
          statusLabel: leadStatusLabel(task.lead.status),
          companyId: task.lead.companyId,
        }
      : null,
  };
}
