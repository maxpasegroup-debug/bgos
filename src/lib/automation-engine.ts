import "server-only";

import { CompanyPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  runSalesBoosterOnLeadCreated,
  type RunSalesBoosterOnLeadCreatedResult,
} from "@/lib/sales-booster-engine";

type NewLeadInput = {
  id: string;
  companyId: string;
  assignedTo: string | null;
};

type HandleLeadCreatedArgs = {
  lead: NewLeadInput;
  actorUserId: string;
  assigneeExplicit: boolean;
  initialAssigneeId: string;
  modeOverride?: "assign" | "whatsapp" | "both";
};

/**
 * Unified lead-created automation entrypoint.
 * BASIC: no-op.
 * PRO: assignment + follow-up tasks.
 * ENTERPRISE: includes simulated WhatsApp flow.
 */
export async function handleLeadCreated(
  args: HandleLeadCreatedArgs,
): Promise<RunSalesBoosterOnLeadCreatedResult> {
  const company = await prisma.company.findUnique({
    where: { id: args.lead.companyId },
    select: { plan: true },
  });
  if (!company || company.plan === CompanyPlan.BASIC) {
    return {
      ran: false,
      mode: "assign",
      reassigned: false,
      assignedUserId: null,
      whatsappLogged: false,
      followUpTasksCreated: 0,
    };
  }

  const modeForPlan =
    args.modeOverride ??
    (company.plan === CompanyPlan.ENTERPRISE ? "both" : "assign");

  return runSalesBoosterOnLeadCreated({
    leadId: args.lead.id,
    companyId: args.lead.companyId,
    actorUserId: args.actorUserId,
    assigneeExplicit: args.assigneeExplicit,
    initialAssigneeId: args.initialAssigneeId,
    modeOverride: modeForPlan,
  });
}
