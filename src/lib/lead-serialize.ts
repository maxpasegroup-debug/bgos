import type { LeadStatus } from "@prisma/client";
import { leadStatusLabel } from "@/lib/lead-pipeline";

export type LeadWithAssignee = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  value: number | null;
  iceconnectLocation?: string | null;
  currentStage?: string | null;
  lastActivityAt?: Date | null;
  nextActionDue?: Date | null;
  activityCount?: number;
  responseStatus?: string | null;
  confidenceScore?: number;
  nexaPriority?: boolean;
  nexaMovedAt?: Date | null;
  nexaMovedReason?: string | null;
  companyId: string;
  assignedTo: string | null;
  createdByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string; email: string } | null;
};

export function serializeLead(lead: LeadWithAssignee) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    statusLabel: leadStatusLabel(lead.status),
    value: lead.value,
    location: lead.iceconnectLocation ?? null,
    currentStage: lead.currentStage ?? null,
    lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
    nextActionDue: lead.nextActionDue?.toISOString() ?? null,
    activityCount: lead.activityCount ?? 0,
    responseStatus: lead.responseStatus ?? null,
    confidenceScore: lead.confidenceScore ?? null,
    nexaPriority: lead.nexaPriority ?? false,
    nexaMovedAt: lead.nexaMovedAt?.toISOString() ?? null,
    nexaMovedReason: lead.nexaMovedReason ?? null,
    companyId: lead.companyId,
    assignedTo: lead.assignedTo,
    createdByUserId: lead.createdByUserId,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignee: lead.assignee,
  };
}
