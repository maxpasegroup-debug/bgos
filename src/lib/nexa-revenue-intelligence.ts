import { IceconnectCustomerPlan, LeadResponseStatus, LeadStatus } from "@prisma/client";
import { PRICING } from "@/config/pricing";

type StageName = "New" | "Introduced" | "Demo" | "Follow-up" | "Onboard" | "Subscription" | "Lost";

export type PredictiveLeadInput = {
  id: string;
  name: string;
  status: LeadStatus;
  value: number | null;
  assignedTo: string | null;
  assigneeName?: string | null;
  updatedAt: Date;
  lastActivityAt: Date | null;
  activityCount: number;
  responseStatus: LeadResponseStatus;
  internalCallStatus: string | null;
  iceconnectMetroStage: string | null;
  iceconnectCustomerPlan: IceconnectCustomerPlan | null;
};

export type PredictiveLeadOutput = {
  stage: StageName;
  score: number;
  conversionProbability: number;
  expectedRevenue: number;
  probabilityBand: "HIGH" | "MEDIUM" | "RISK";
  predictedCloseDays: [number, number] | null;
  predictedCloseDate: string | null;
  priorityRank: number;
};

function toStage(status: LeadStatus): StageName {
  if (status === LeadStatus.NEW) return "New";
  if (status === LeadStatus.CONTACTED || status === LeadStatus.QUALIFIED) return "Introduced";
  if (
    status === LeadStatus.SITE_VISIT_SCHEDULED ||
    status === LeadStatus.SITE_VISIT_COMPLETED ||
    status === LeadStatus.PROPOSAL_SENT
  ) return "Demo";
  if (status === LeadStatus.NEGOTIATION) return "Follow-up";
  if (status === LeadStatus.PROPOSAL_WON) return "Onboard";
  if (status === LeadStatus.WON) return "Subscription";
  return "Lost";
}

function stageWeight(stage: StageName): number {
  if (stage === "New") return 10;
  if (stage === "Introduced") return 25;
  if (stage === "Demo") return 50;
  if (stage === "Follow-up") return 70;
  if (stage === "Onboard") return 85;
  if (stage === "Subscription") return 100;
  return 0;
}

function planValue(plan: IceconnectCustomerPlan | null, fallback: number | null): number {
  if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) return fallback;
  if (plan === IceconnectCustomerPlan.BASIC) return PRICING.BASIC.price;
  if (plan === IceconnectCustomerPlan.PRO) return PRICING.PRO.price;
  if (plan === IceconnectCustomerPlan.ENTERPRISE) return PRICING.PRO.price;
  return PRICING.BASIC.price;
}

function hoursSince(ts: Date | null, now: Date): number {
  if (!ts) return Number.POSITIVE_INFINITY;
  return (now.getTime() - ts.getTime()) / 36e5;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function closeWindow(stage: StageName): [number, number] | null {
  if (stage === "New") return [7, 10];
  if (stage === "Introduced") return [5, 7];
  if (stage === "Demo") return [3, 5];
  if (stage === "Follow-up") return [1, 3];
  if (stage === "Onboard") return [1, 2];
  return null;
}

export function scoreLead(input: PredictiveLeadInput, now = new Date()): PredictiveLeadOutput {
  const stage = toStage(input.status);
  let score = stageWeight(stage);
  const inactivityHrs = hoursSince(input.lastActivityAt ?? input.updatedAt, now);

  if (input.internalCallStatus === "CALLED") score += 10;
  if (input.status === LeadStatus.SITE_VISIT_COMPLETED || input.iceconnectMetroStage === "DEMO_DONE")
    score += 15;
  if (input.status === LeadStatus.PROPOSAL_SENT || input.status === LeadStatus.PROPOSAL_WON) score += 20;
  if (input.iceconnectMetroStage === "PAYMENT_DONE" || input.status === LeadStatus.PROPOSAL_WON) score += 30;

  if (input.responseStatus === LeadResponseStatus.SILENT || inactivityHrs >= 48) score -= 20;
  if (input.status === LeadStatus.SITE_VISIT_SCHEDULED && inactivityHrs >= 48) score -= 30;
  if (inactivityHrs >= 24 * 5) score -= 40;

  score = clamp(score, 0, 100);

  let conversionProbability = score;
  if (input.status !== LeadStatus.WON) conversionProbability = Math.min(95, conversionProbability);
  if (input.status === LeadStatus.WON) conversionProbability = 100;

  const expectedRevenue = Math.round(planValue(input.iceconnectCustomerPlan, input.value) * (conversionProbability / 100));
  const probabilityBand: "HIGH" | "MEDIUM" | "RISK" =
    conversionProbability >= 70 ? "HIGH" : conversionProbability >= 40 ? "MEDIUM" : "RISK";

  const window = closeWindow(stage);
  const meanDays = window ? Math.ceil((window[0] + window[1]) / 2) : 0;
  const predictedCloseDate = window ? new Date(now.getTime() + meanDays * 86400000).toISOString() : null;
  const priorityRank = Math.round(conversionProbability * 1000 + expectedRevenue / 10);

  return {
    stage,
    score,
    conversionProbability,
    expectedRevenue,
    probabilityBand,
    predictedCloseDays: window,
    predictedCloseDate,
    priorityRank,
  };
}

export function buildRevenueForecast(
  rows: Array<PredictiveLeadInput & { assigneeName?: string | null }>,
) {
  const now = new Date();
  const scored = rows.map((r) => ({ lead: r, intel: scoreLead(r, now) }));
  const byStage: Record<string, number> = {};
  const byExecutive: Record<string, number> = {};
  let totalExpectedRevenue = 0;
  let likelyClosures = 0;
  const highProbabilityLeads: Array<{
    leadId: string;
    name: string;
    probability: number;
    expectedRevenue: number;
    assignee: string;
  }> = [];
  const riskLeads: Array<{
    leadId: string;
    name: string;
    probability: number;
    inactivityHours: number;
  }> = [];

  for (const row of scored) {
    const { lead, intel } = row;
    totalExpectedRevenue += intel.expectedRevenue;
    byStage[intel.stage] = (byStage[intel.stage] ?? 0) + intel.expectedRevenue;
    const owner = lead.assigneeName?.trim() || "Unassigned";
    byExecutive[owner] = (byExecutive[owner] ?? 0) + intel.expectedRevenue;
    if (intel.conversionProbability >= 70) likelyClosures += 1;
    if (intel.conversionProbability >= 70) {
      highProbabilityLeads.push({
        leadId: lead.id,
        name: lead.name,
        probability: intel.conversionProbability,
        expectedRevenue: intel.expectedRevenue,
        assignee: owner,
      });
    }
    if (intel.conversionProbability < 40) {
      riskLeads.push({
        leadId: lead.id,
        name: lead.name,
        probability: intel.conversionProbability,
        inactivityHours: Math.round(hoursSince(lead.lastActivityAt ?? lead.updatedAt, now)),
      });
    }
  }

  highProbabilityLeads.sort((a, b) => b.probability * b.expectedRevenue - a.probability * a.expectedRevenue);
  riskLeads.sort((a, b) => a.probability - b.probability);
  const topFocus = highProbabilityLeads.slice(0, 5);
  const topRisk = riskLeads.slice(0, 5);

  const alerts: string[] = [];
  if (topRisk.length > 0) alerts.push(`${topRisk.length} high-value leads at risk`);
  const focusValue = topFocus.reduce((s, x) => s + x.expectedRevenue, 0);
  if (topFocus.length > 0) alerts.push(`Focus on these ${topFocus.length} leads to close ₹${focusValue.toLocaleString("en-IN")}`);

  return {
    totalExpectedRevenue,
    likelyClosures,
    byStage,
    byExecutive,
    highProbabilityLeads: topFocus,
    riskLeads: topRisk,
    alerts,
    scoredLeads: scored,
  };
}
