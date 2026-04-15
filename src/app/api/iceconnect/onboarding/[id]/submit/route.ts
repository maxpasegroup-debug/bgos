import {
  CompanyPlan,
  IceconnectMetroStage,
  LeadStatus,
  OnboardingStatus,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { mapRoles, type NexaMappedMember } from "@/lib/nexa-intelligence";
import {
  deriveArchitectureSummary,
  mapOperationsToDashboards,
  mapTeamEntries,
  type DashboardStatus,
} from "@/lib/nexa-onboarding-engine";
import { runNexaAutonomousEvent } from "@/lib/nexa-autonomous-engine";
import { runOnboardingLaunch } from "@/lib/onboarding-launch-engine";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const teamMemberSchema = z.object({
  role: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
});

const bodySchema = z.object({
  leadId: z.string().trim().min(1),
  companyName: z.string().trim().min(1).max(200),
  location: z.string().trim().max(500).optional(),
  industry: z.enum(["SOLAR", "EDUCATION", "HEALTHCARE", "CUSTOM"]),
  customIndustryLabel: z.string().trim().max(120).optional(),
  operations: z.array(z.string().trim().min(1).max(120)).default([]),
  team: z.array(teamMemberSchema).min(1).max(40),
});

function industryLabel(i: z.infer<typeof bodySchema>["industry"], custom?: string | null) {
  if (i === "CUSTOM") return (custom?.trim() || "Custom").slice(0, 120);
  if (i === "SOLAR") return "Solar";
  if (i === "EDUCATION") return "Education";
  return "Healthcare";
}

function launchIndustry(i: z.infer<typeof bodySchema>["industry"]): "SOLAR" | "CUSTOM" {
  return i === "SOLAR" ? "SOLAR" : "CUSTOM";
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;

  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { id: onboardingId } = await ctx.params;
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.industry === "CUSTOM" && !parsed.data.customIndustryLabel?.trim()) {
    return jsonError(400, "CUSTOM_INDUSTRY_REQUIRED", "Enter a custom industry label.");
  }

  try {
    const ob = await prisma.onboarding.findFirst({
      where: { id: onboardingId, lead: { companyId: session.companyId } },
      include: { lead: { select: { id: true, assignedTo: true, iceconnectMetroStage: true } } },
    });
    if (!ob) return jsonError(404, "NOT_FOUND", "Onboarding not found.");
    if (ob.status !== OnboardingStatus.IN_PROGRESS) {
      return jsonError(400, "NOT_IN_PROGRESS", "This onboarding is already completed.");
    }
    if (ob.leadId !== parsed.data.leadId) {
      return jsonError(400, "LEAD_MISMATCH", "Lead does not match onboarding record.");
    }

    const canRun = ob.lead.assignedTo === session.sub || isIceconnectPrivileged(session.role);
    if (!canRun) {
      return jsonError(403, "FORBIDDEN", "Only the assignee or manager can submit onboarding.");
    }

    const stage = ob.lead.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED;
    const order = [
      IceconnectMetroStage.LEAD_CREATED,
      IceconnectMetroStage.INTRO_CALL,
      IceconnectMetroStage.DEMO_DONE,
      IceconnectMetroStage.FOLLOW_UP,
      IceconnectMetroStage.ONBOARDING,
      IceconnectMetroStage.PAYMENT_DONE,
      IceconnectMetroStage.SUBSCRIPTION,
    ];
    const idx = order.indexOf(stage);
    const demoIdx = order.indexOf(IceconnectMetroStage.DEMO_DONE);
    if (idx < demoIdx) {
      return jsonError(400, "LEAD_NOT_READY", "Lead must be at Demo stage or later.");
    }

    const parsedMembers: NexaMappedMember[] = mapRoles(
      parsed.data.team.map((m) => ({ name: m.name, roleRaw: m.role })),
    );
    const teamMapped = mapTeamEntries(parsed.data.team);
    const requiredDashboards = mapOperationsToDashboards(parsed.data.operations);
    const architecture = deriveArchitectureSummary({
      requiredDashboards,
      team: teamMapped,
    });

    const launch = await runOnboardingLaunch({
      ownerUserId: session.sub,
      ownerEmail: session.email,
      companyName: parsed.data.companyName,
      industry: launchIndustry(parsed.data.industry),
      team: parsedMembers,
      referralPhone: null,
      sessionId: null,
      addingAnotherBusiness: true,
      customWorkspacePlan:
        launchIndustry(parsed.data.industry) === "CUSTOM" ? CompanyPlan.PRO : null,
      profile: {
        billingAddress: parsed.data.location?.trim() ? parsed.data.location.trim() : null,
      },
    });

    if (!launch.ok) {
      return NextResponse.json(
        { ok: false as const, error: launch.error, code: launch.code },
        { status: launch.status ?? 400 },
      );
    }

    const label = industryLabel(parsed.data.industry, parsed.data.customIndustryLabel);

    const techRequests = teamMapped.filter((t) => !t.mapped);

    await prisma.$transaction(async (tx) => {
      for (const req of techRequests) {
        await tx.techRequest.create({
          data: {
            roleName: req.role,
            description: `Requested by ${session.email} during Nexa onboarding`,
            companyId: launch.companyId,
            status: "pending",
          },
        });
      }

      const mems = await tx.userCompany.findMany({
        where: { companyId: launch.companyId },
        include: { user: { select: { id: true, name: true } } },
      });
      for (const m of mems) {
        const matched = teamMapped.find(
          (t) => t.name.toLowerCase() === (m.user.name ?? "").trim().toLowerCase(),
        );
        const status: DashboardStatus = matched?.mapped ? "READY" : "PENDING_BUILD";
        await tx.userCompany.update({
          where: { id: m.id },
          data: {
            dashboardAssigned: matched?.mappedDashboard ?? null,
            status,
          },
        });
      }

      await tx.onboarding.update({
        where: { id: onboardingId },
        data: {
          status: OnboardingStatus.COMPLETED,
          companyId: launch.companyId,
          meta: {
            industry: parsed.data.industry,
            industryLabel: label,
            location: parsed.data.location ?? null,
            operations: parsed.data.operations,
            requiredDashboards,
            architecture,
            team: teamMapped,
          } as object,
        },
      });

      await tx.onboardingSession.updateMany({
        where: { leadId: ob.leadId, createdByUserId: session.sub },
        data: {
          companyId: launch.companyId,
          companyName: parsed.data.companyName,
          industry: label,
          status: "launched",
          data: {
            industry: parsed.data.industry,
            industryLabel: label,
            operations: parsed.data.operations,
            requiredDashboards,
            architecture,
            team: teamMapped,
          } as object,
        },
      });

      await tx.lead.update({
        where: { id: ob.leadId },
        data: {
          leadCompanyName: parsed.data.companyName,
          businessType: label,
          iceconnectLocation: parsed.data.location?.trim() ? parsed.data.location.trim() : null,
          iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
          iceconnectSubscribedAt: new Date(),
          status: LeadStatus.WON,
          internalStageUpdatedAt: new Date(),
        },
      });
    });

    await runNexaAutonomousEvent({
      companyId: launch.companyId,
      actorUserId: session.sub,
      event: "onboarding_completed",
      payload: { onboardingId },
    });

    return NextResponse.json({
      ok: true as const,
      companyId: launch.companyId,
      credentials: launch.credentials,
      dashboardsAssigned: launch.dashboardsAssigned,
      employeesCreated: launch.employeesCreated,
      requiredDashboards,
      architecture,
      team: teamMapped,
      techQueue: techRequests.map((t) => ({
        roleName: t.role,
        status: "PENDING_BUILD",
        message:
          "This role needs a custom dashboard. Our tech team will create it within 24 hours.",
      })),
      upgrade: {
        message:
          "To unlock full automation and tracking, upgrade to PRO.",
        plans: [
          { id: "BASIC", label: "Basic", note: "Trial-friendly" },
          { id: "PRO", label: "Pro", note: "Full automation + tracking" },
          { id: "ENTERPRISE", label: "Enterprise", note: "Custom scale" },
        ],
        ctaHref: "/iceconnect/wallet",
      },
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/iceconnect/onboarding/[id]/submit", e);
  }
}
