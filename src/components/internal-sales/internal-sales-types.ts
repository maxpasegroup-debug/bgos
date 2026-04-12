import type { InternalCallStatus, InternalSalesStage, InternalTechStage } from "@prisma/client";

export type LeadCard = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  businessType: string | null;
  notes: string | null;
  stage: InternalSalesStage;
  stageLabel: string;
  callStatus: InternalCallStatus;
  callStatusLabel: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string } | null;
  createdAt: string;
  onboardingStatus?: string;
  pendingBossApproval?: boolean;
  internalTechStage?: InternalTechStage | null;
};

export type PipelineCol = { key: InternalSalesStage; label: string; leads: LeadCard[] };

export type TeamMember = { id: string; name: string; email: string; jobRole: string };
