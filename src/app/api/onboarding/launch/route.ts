import { CompanyPlan, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireOnboardingLaunchSession } from "@/lib/auth";
import { mapRoles, parseTeamInput, type NexaMappedMember } from "@/lib/nexa-intelligence";
import { runOnboardingLaunch } from "@/lib/onboarding-launch-engine";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
];

const parsedMemberSchema = z.object({
  name: z.string(),
  roleRaw: z.string(),
  department: z.enum(["SALES", "ADMIN", "TECH", "OTHER"]),
  dashboard: z
    .enum(["SALES_DASHBOARD", "ADMIN_DASHBOARD", "TECH_DASHBOARD", "GENERAL_DASHBOARD"])
    .optional(),
  userRole: z.nativeEnum(UserRole),
  email: z.string().email().optional(),
});

function withDashboardDefaults(m: z.infer<typeof parsedMemberSchema>): NexaMappedMember {
  return {
    name: m.name,
    roleRaw: m.roleRaw,
    department: m.department,
    dashboard: m.dashboard ?? "GENERAL_DASHBOARD",
    userRole: m.userRole,
    email: m.email,
  };
}

const bodySchema = z.object({
  source: z.literal("NEXA_ENGINE"),
  sessionId: z.string().trim().optional(),
  companyName: z.string().trim().min(1).max(200),
  industry: z.enum(["SOLAR", "CUSTOM"]),
  rawTeamInput: z.string().trim().optional(),
  parsedTeam: z.array(parsedMemberSchema).optional(),
  referralPhone: z.string().trim().optional(),
  customWorkspacePlan: z.nativeEnum(CompanyPlan).optional(),
  logoUrl: z.string().max(2048).optional(),
  primaryColor: z.string().max(32).optional(),
  secondaryColor: z.string().max(32).optional(),
  companyEmail: z.union([z.literal(""), z.string().email().max(200)]).optional(),
  companyPhone: z.string().max(40).optional(),
  billingAddress: z.string().max(4000).optional(),
  gstNumber: z.string().max(32).optional(),
  bankDetails: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireOnboardingLaunchSession(request, ALLOWED);
    if (actor instanceof NextResponse) return actor;

    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const teamFromRaw = parsed.data.rawTeamInput
      ? mapRoles(parseTeamInput(parsed.data.rawTeamInput))
      : [];
    const incomingTeam: NexaMappedMember[] =
      parsed.data.parsedTeam && parsed.data.parsedTeam.length > 0
        ? parsed.data.parsedTeam.map(withDashboardDefaults)
        : teamFromRaw;

    const launch = await runOnboardingLaunch({
      ownerUserId: actor.user.sub,
      ownerEmail: actor.user.email,
      companyName: parsed.data.companyName,
      industry: parsed.data.industry,
      team: incomingTeam,
      referralPhone: parsed.data.referralPhone,
      sessionId: parsed.data.sessionId,
      addingAnotherBusiness: actor.addingAnotherBusiness,
      customWorkspacePlan:
        parsed.data.industry === "CUSTOM" ? (parsed.data.customWorkspacePlan ?? null) : null,
      profile: {
        logoUrl: parsed.data.logoUrl,
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor,
        companyEmail: parsed.data.companyEmail,
        companyPhone: parsed.data.companyPhone,
        billingAddress: parsed.data.billingAddress,
        gstNumber: parsed.data.gstNumber,
        bankDetails: parsed.data.bankDetails,
      },
    });

    if (!launch.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          success: false as const,
          error: launch.error,
          code: launch.code,
          ...(launch.step_failed ? { step_failed: launch.step_failed } : {}),
        },
        { status: launch.status ?? 400 },
      );
    }

    const res = NextResponse.json({
      ok: true as const,
      success: true as const,
      user_id: actor.user.sub,
      company_id: launch.companyId,
      companyId: launch.companyId,
      session_ready: true as const,
      employeesCreated: launch.employeesCreated,
      dashboardsAssigned: launch.dashboardsAssigned,
      credentials: launch.credentials,
      credentialsFile: launch.credentialsFile,
      pipeline: launch.pipeline,
      onboardingPlan: launch.onboardingPlan,
      ...(launch.existing ? { existing: true as const } : {}),
      ...(launch.requiresCustomPayment
        ? { requiresCustomPayment: true as const, nextStep: launch.nextStep }
        : {}),
    });

    try {
      await setSessionCookie(res, launch.sessionJwt);
      await setActiveCompanyCookie(res, launch.activeCompanyId);
    } catch (cookieErr) {
      console.error("POST /api/onboarding/launch cookie attach failed", cookieErr);
      return NextResponse.json(
        {
          ok: false as const,
          success: false as const,
          error: "Could not finalize your session. Please try again.",
          code: "SERVER_ERROR" as const,
          step_failed: "session_mint" as const,
        },
        { status: 500 },
      );
    }

    return res;
  } catch (error) {
    console.error("POST /api/onboarding/launch", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "SERVER_ERROR" as const,
        step_failed: "unknown" as const,
      },
      { status: 500 },
    );
  }
}
