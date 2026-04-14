import {
  CompanyBusinessType,
  CompanyPlan,
  CompanySubscriptionStatus,
  UserRole,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { mintSessionAccessTokenForUser } from "@/lib/mint-session-token";
import { prisma } from "@/lib/prisma";
import { razorpayAmountForPlan } from "@/lib/razorpay-billing";
import { requireRazorpayConfigOr503 } from "@/lib/razorpay-env-guards";
import { setActiveCompanyCookie, setSessionCookie } from "@/lib/session-cookie";
import { companyMembershipClass } from "@/lib/user-company";

const bodySchema = z.object({
  companyName: z.string().trim().min(1),
  plan: z.enum(["basic", "pro", "enterprise"]),
  businessType: z.string().trim().min(1),
  departments: z.string().trim().optional(),
  workflow: z.string().trim().optional(),
  teamRaw: z.string().trim().optional(),
});

function toPlan(v: "basic" | "pro" | "enterprise"): CompanyPlan {
  if (v === "enterprise") return CompanyPlan.ENTERPRISE;
  if (v === "pro") return CompanyPlan.PRO;
  return CompanyPlan.BASIC;
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const billing = requireRazorpayConfigOr503();
    if (billing instanceof NextResponse) return billing;

    const targetPlan = toPlan(parsed.data.plan);
    const now = new Date();
    let companyId = auth.companyId;
    if (!companyId) {
      const created = await prisma.company.create({
        data: {
          name: parsed.data.companyName,
          ownerId: auth.sub,
          industry: "SOLAR",
          businessType: CompanyBusinessType.CUSTOM,
          plan: targetPlan,
          subscriptionStatus: CompanySubscriptionStatus.PAYMENT_PENDING,
          isTrialActive: false,
        },
        select: { id: true },
      });
      companyId = created.id;
      await prisma.userCompany.create({
        data: {
          userId: auth.sub,
          companyId,
          role: companyMembershipClass(UserRole.ADMIN),
          jobRole: UserRole.ADMIN,
        },
      });
    } else {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          name: parsed.data.companyName,
          businessType: CompanyBusinessType.CUSTOM,
          plan: targetPlan,
          subscriptionStatus: CompanySubscriptionStatus.PAYMENT_PENDING,
          isTrialActive: false,
        },
      });
    }

    await prisma.onboardingSession.create({
      data: {
        companyName: parsed.data.companyName,
        industry: "CUSTOM",
        rawTeamInput: parsed.data.teamRaw ?? "",
        parsedTeam: [],
        unknownRoles: [],
        status: "draft",
        createdByUserId: auth.sub,
      },
    });

    const rz = new Razorpay({ key_id: billing.keyId, key_secret: billing.keySecret });
    const order = await rz.orders.create({
      amount: razorpayAmountForPlan(targetPlan),
      currency: "INR",
      receipt: `custom_${now.getTime()}`.slice(0, 40),
      notes: {
        userId: auth.sub,
        companyId,
        plan: String(targetPlan),
      },
    });

    const token = await mintSessionAccessTokenForUser({
      userId: auth.sub,
      email: auth.email,
      activeCompanyId: companyId,
    });
    const res = NextResponse.json({
      ok: true as const,
      companyId,
      order: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    });
    await setSessionCookie(res, token);
    await setActiveCompanyCookie(res, companyId);
    return res;
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      {
        ok: false as const,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "SERVER_ERROR" as const,
      },
      { status: 500 },
    );
  }
}
