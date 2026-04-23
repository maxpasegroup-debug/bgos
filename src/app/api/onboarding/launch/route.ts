import { CompanyIndustry, CompanyPlan, Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireOnboardingLaunchSession } from "@/lib/auth";
import { applyIndustryTemplate } from "@/lib/industry-templates";
import { prisma } from "@/lib/prisma";
import {
  createOnboardingCompany,
  markOnboardingSessionReady,
  normalizeRequestedIndustry,
  planFromInput,
} from "@/lib/onboarding-company";
import { mintSessionAccessTokenForUser } from "@/lib/mint-session-token";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { credentialsWorkbookBase64, generateEmail, generatePassword } from "@/lib/company-launch-engine";

const teamMemberSchema = z.object({
  name: z.string().trim().min(1),
  roleRaw: z.string().trim().optional(),
  role: z.string().trim().optional(),
  department: z.string().trim().optional(),
  dashboard: z.string().trim().optional(),
  userRole: z.string().trim().optional(),
});

const bodySchema = z.object({
  source: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  companyName: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  parsedTeam: z.array(teamMemberSchema).optional().default([]),
  customWorkspacePlan: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const actor = await requireOnboardingLaunchSession(request, [UserRole.ADMIN, UserRole.MANAGER]);
  if (actor instanceof NextResponse) return actor;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const auth = actor.user;

  try {
    const requestedIndustry = normalizeRequestedIndustry(parsed.data.industry);
    const planOverride =
      planFromInput(parsed.data.customWorkspacePlan) ??
      (requestedIndustry === "CUSTOM" ? CompanyPlan.PRO : undefined);

    const created = await createOnboardingCompany({
      userId: auth.sub,
      companyName: parsed.data.companyName,
      requestedIndustry,
      planOverride,
    });

    await markOnboardingSessionReady({
      sessionId: parsed.data.sessionId,
      userId: auth.sub,
      companyId: created.companyId,
      companyName: parsed.data.companyName,
      industry: requestedIndustry,
      parsedTeam: parsed.data.parsedTeam as unknown as Prisma.InputJsonValue,
      source: parsed.data.source ?? "DIRECT",
    });

    if (requestedIndustry === "SOLAR") {
      await applyIndustryTemplate(created.companyId, CompanyIndustry.SOLAR);
    } else {
      await prisma.company.update({
        where: { id: created.companyId },
        data: {
          dashboardConfig: {
            nexaOnboardBoss: {
              parsedTeam: parsed.data.parsedTeam,
              updatedAt: new Date().toISOString(),
            },
            onboardingStatus: requestedIndustry === "CUSTOM" ? "under_review" : "ready",
          },
        },
      });
    }

    await prisma.user.update({
      where: { id: auth.sub },
      data: { workspaceActivatedAt: new Date() },
    });

    const token = await mintSessionAccessTokenForUser({
      userId: auth.sub,
      email: auth.email,
      activeCompanyId: created.companyId,
    });

    const credentials = [
      {
        name: "Boss Admin",
        role: "ADMIN",
        email: auth.email,
        password: "Use your signup password",
        loginUrl: "/login",
      },
      ...parsed.data.parsedTeam.map((member) => ({
        name: member.name,
        role: member.roleRaw || member.role || "Manager",
        email: generateEmail(parsed.data.companyName, member.name),
        password: generatePassword(parsed.data.companyName, member.name),
        loginUrl: "/login",
      })),
    ];

    const res = NextResponse.json({
      ok: true as const,
      success: true as const,
      company_id: created.companyId,
      user_id: auth.sub,
      session_ready: true as const,
      redirectPath: created.redirectPath,
      credentials,
      credentialsFile: {
        filename: `${parsed.data.companyName.trim().replace(/\s+/g, "-").toLowerCase()}-credentials.xlsx`,
        base64: credentialsWorkbookBase64(credentials),
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    await setSessionCookie(res, token);
    await setActiveCompanyCookie(res, created.companyId);
    return res;
  } catch (error) {
    console.error("POST /api/onboarding/launch", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: "Could not launch onboarding",
        code: "SERVER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
