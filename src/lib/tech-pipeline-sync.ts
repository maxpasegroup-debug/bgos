import "server-only";

import { InternalTechStage, TechPipelineStage, TechQueuePriority } from "@prisma/client";

const PIPELINE_ORDER: TechPipelineStage[] = [
  TechPipelineStage.RECEIVED,
  TechPipelineStage.SETUP_DASHBOARD,
  TechPipelineStage.ADD_EMPLOYEES,
  TechPipelineStage.CONFIGURE_MODULES,
  TechPipelineStage.TESTING,
  TechPipelineStage.READY,
];

export function orderedPipelineStages(): readonly TechPipelineStage[] {
  return PIPELINE_ORDER;
}

export function pipelineStageLabel(s: TechPipelineStage): string {
  const labels: Record<TechPipelineStage, string> = {
    [TechPipelineStage.RECEIVED]: "Received",
    [TechPipelineStage.SETUP_DASHBOARD]: "Setup dashboard",
    [TechPipelineStage.ADD_EMPLOYEES]: "Add employees",
    [TechPipelineStage.CONFIGURE_MODULES]: "Configure modules",
    [TechPipelineStage.TESTING]: "Testing",
    [TechPipelineStage.READY]: "Ready",
  };
  return labels[s];
}

export function techPriorityLabel(p: TechQueuePriority): string {
  const labels: Record<TechQueuePriority, string> = {
    [TechQueuePriority.CRITICAL]: "Enterprise",
    [TechQueuePriority.HIGH]: "Pro",
    [TechQueuePriority.LOW]: "Basic",
  };
  return labels[p];
}

/** Maps onboarding task pipeline step → lead tech metro (canonical internal stages). */
export function pipelineStageToInternalTech(s: TechPipelineStage): InternalTechStage {
  const m: Record<TechPipelineStage, InternalTechStage> = {
    [TechPipelineStage.RECEIVED]: InternalTechStage.ONBOARDING_RECEIVED,
    [TechPipelineStage.SETUP_DASHBOARD]: InternalTechStage.DASHBOARD_SETUP,
    [TechPipelineStage.ADD_EMPLOYEES]: InternalTechStage.EMPLOYEE_SETUP,
    [TechPipelineStage.CONFIGURE_MODULES]: InternalTechStage.DATA_VERIFIED,
    [TechPipelineStage.TESTING]: InternalTechStage.SYSTEM_TESTING,
    [TechPipelineStage.READY]: InternalTechStage.READY_FOR_DELIVERY,
  };
  return m[s];
}

/** Best-effort reverse map when lead was advanced via legacy tech-pipeline API. */
export function internalTechToPipelineStage(t: InternalTechStage): TechPipelineStage {
  const m: Partial<Record<InternalTechStage, TechPipelineStage>> = {
    [InternalTechStage.ONBOARDING_RECEIVED]: TechPipelineStage.RECEIVED,
    [InternalTechStage.DASHBOARD_SETUP]: TechPipelineStage.SETUP_DASHBOARD,
    [InternalTechStage.EMPLOYEE_SETUP]: TechPipelineStage.ADD_EMPLOYEES,
    [InternalTechStage.DATA_VERIFIED]: TechPipelineStage.CONFIGURE_MODULES,
    [InternalTechStage.SYSTEM_TESTING]: TechPipelineStage.TESTING,
    [InternalTechStage.READY_FOR_DELIVERY]: TechPipelineStage.READY,
  };
  return m[t] ?? TechPipelineStage.RECEIVED;
}

export function nextPipelineStage(current: TechPipelineStage): TechPipelineStage | null {
  const i = PIPELINE_ORDER.indexOf(current);
  if (i < 0 || i >= PIPELINE_ORDER.length - 1) return null;
  return PIPELINE_ORDER[i + 1] ?? null;
}
