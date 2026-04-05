import type { LeadStatus } from "@prisma/client";
import { leadStatusLabel } from "@/lib/lead-pipeline";

export type LeadWithAssignee = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  value: number | null;
  companyId: string;
  assignedTo: string | null;
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
    companyId: lead.companyId,
    assignedTo: lead.assignedTo,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignee: lead.assignee,
  };
}
