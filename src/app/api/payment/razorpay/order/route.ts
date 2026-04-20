import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CompanyBusinessType, CompanyPlan, CompanySubscriptionStatus } from "@prisma/client";
import Razorpay from "razorpay";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { PRICING_VERSION, RAZORPAY_PLAN_IDS, applyDiscountToPlanInr, inrToPaise } from "@/config/pricing";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { razorpayAmountForPlan } from "@/lib/razorpay-billing";
import { razorpayLiveRequiresHttpsOr400, requireRazorpayConfigOr503 } from "@/lib/razorpay-env-guards";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["basic", "pro", "enterprise"]),
  discountCode: z.string().trim().max(50).optional(),
});

/**
 * Creates a Razorpay Order (server-side). Client opens Checkout with {@link NEXT_PUBLIC_RAZORPAY_KEY_ID}.
 */
export async function POST(request: NextRequest) {
  const billing = requireRazorpayConfigOr503();
  if (billing instanceof NextResponse) return billing;

  const httpsBlock = razorpayLiveRequiresHttpsOr400(request);
  if (httpsBlock) return httpsBlock;

  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;
  if (!USER_ADMIN_ROLES.includes(session.role)) {
    return jsonError(403, "FORBIDDEN", "You are not allowed to create payment orders.");
  }

  if (!session.companyId) {
    return jsonError(400, "NEEDS_COMPANY", "Create a company before purchasing a plan.");
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const targetPlan: CompanyPlan =
    parsed.data.plan === "pro"
      ? CompanyPlan.PRO
      : parsed.data.plan === "enterprise"
        ? CompanyPlan.ENTERPRISE
        : CompanyPlan.BASIC;
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { id: true, plan: true, subscriptionStatus: true, businessType: true },
  });
  if (!company) {
    return jsonError(404, "NOT_FOUND", "Company not found.");
  }

  const customPending =
    company.businessType === CompanyBusinessType.CUSTOM &&
    company.subscriptionStatus === CompanySubscriptionStatus.PAYMENT_PENDING;

  if (customPending) {
    if (targetPlan !== company.plan) {
      return jsonError(
        400,
        "PLAN_MISMATCH",
        "Checkout must match the plan you selected for your custom workspace.",
      );
    }
  } else {
    if (
      company.plan === CompanyPlan.ENTERPRISE &&
      company.businessType !== CompanyBusinessType.CUSTOM
    ) {
      return jsonError(400, "INVALID_PLAN", "Enterprise billing is via sales — use Contact Sales.");
    }
    if (targetPlan === CompanyPlan.BASIC && company.plan !== CompanyPlan.BASIC) {
      return jsonError(400, "INVALID_PLAN", "Basic checkout is only for workspaces on the Basic plan.");
    }
  }

  const pricing = applyDiscountToPlanInr(targetPlan, parsed.data.discountCode);
  const amount = inrToPaise(pricing.finalPriceInr);
  const expectedBaseAmount = razorpayAmountForPlan(targetPlan);
  if (pricing.appliedDiscountCode === null && amount !== expectedBaseAmount) {
    return jsonError(400, "PRICING_LOCK_FAILED", "Pricing lock failed.");
  }
  const receipt = `bgos_${randomBytes(10).toString("hex")}`.slice(0, 40);
  const razorpayPlanId = RAZORPAY_PLAN_IDS[targetPlan];

  try {
    const rz = new Razorpay({ key_id: billing.keyId, key_secret: billing.keySecret });
    const order = await rz.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: session.sub,
        companyId: session.companyId,
        plan: String(targetPlan),
        expectedAmountPaise: String(amount),
        pricingVersion: PRICING_VERSION,
        razorpayPlanId: razorpayPlanId || "",
        discountCode: pricing.appliedDiscountCode || "",
      },
    });
    return jsonSuccess({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    return handleApiError("POST /api/payment/razorpay/order", e);
  }
}
