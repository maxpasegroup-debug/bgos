import { CompanyPlan, UserRole, type Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireOnboardingLaunchSession } from "@/lib/auth";
import {
  createOnboardingCompany,
  mapOnboardingTemplate,
  markOnboardingSessionReady,
  planFromInput,
} from "@/lib/onboarding-company";
import { mintSessionAccessTokenForUser } from "@/lib/mint-session-token";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";

const bodySchema = z.object({
  source: z.string().trim().optional(),
  name: z.string().trim().min(1, "Company name is required").max(200),
  industry: z.string().trim().min(1, "Industry is required"),
  businessType: z.string().trim().optional(),
  user_id: z.string().trim().optional(),
  plan: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  parsedTeam: z.custom<Prisma.InputJsonValue>().optional(),
});

export async function POST(request: NextRequest) {
  const actor = await requireOnboardingLaunchSession(request, [UserRole.ADMIN, UserRole.MANAGER]);
  if (actor instanceof NextResponse) return actor;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const auth = actor.user;
  if (parsed.data.user_id && parsed.data.user_id !== auth.sub) {
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: "user_id must match the signed-in user",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  try {
    const requestedIndustry = parsed.data.industry || parsed.data.businessType || "CUSTOM";
    const template = mapOnboardingTemplate(requestedIndustry);
    const planOverride =
      planFromInput(parsed.data.plan) ??
      (template.dashboardTemplate === "CUSTOM" ? CompanyPlan.PRO : undefined);

    const created = await createOnboardingCompany({
      userId: auth.sub,
      companyName: parsed.data.name,
      requestedIndustry,
      planOverride,
    });

    const sessionId = await markOnboardingSessionReady({
      sessionId: parsed.data.sessionId,
      userId: auth.sub,
      companyId: created.companyId,
      companyName: parsed.data.name,
      industry: requestedIndustry,
      parsedTeam: parsed.data.parsedTeam,
      source: parsed.data.source ?? "DIRECT",
    });

    const token = await mintSessionAccessTokenForUser({
      userId: auth.sub,
      email: auth.email,
      activeCompanyId: created.companyId,
    });

    const res = NextResponse.json({
      ok: true as const,
      success: true as const,
      companyId: created.companyId,
      session_id: sessionId,
      redirectPath: created.redirectPath,
      employeeDomain: created.employeeDomain,
    });
    await setSessionCookie(res, token);
    await setActiveCompanyCookie(res, created.companyId);
    return res;
  } catch (error) {
    console.error("POST /api/company/create", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: "Could not create company",
        code: "SERVER_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
