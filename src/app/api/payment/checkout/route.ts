import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { CompanyPlan } from "@prisma/client";
import { z } from "zod";
import {
  appOriginFromRequest,
  getBillingStripeEnv,
  priceIdForTargetPlan,
  stripeClient,
} from "@/lib/billing-stripe";
import { planRank, PLAN, type PaidPlan } from "@/lib/company-plan-values";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

const bodySchema = z.object({
  plan: z.enum(["PRO", "ENTERPRISE"]),
});

/**
 * Creates a Stripe Checkout Session for self-service plan upgrade (boss/admin only).
 * Requires `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE` in env.
 */
export async function POST(request: NextRequest) {
  const billing = getBillingStripeEnv();
  if (!billing) {
    return jsonError(
      503,
      "BILLING_UNAVAILABLE",
      "Online checkout is not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE.",
    );
  }

  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const targetPlan: PaidPlan = parsed.data.plan === "ENTERPRISE" ? PLAN.ENTERPRISE : PLAN.PRO;

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { id: true, plan: true },
  });
  if (!company) {
    return jsonError(404, "NOT_FOUND", "Company not found");
  }

  if (planRank(targetPlan) <= planRank(company.plan as CompanyPlan)) {
    return jsonError(400, "INVALID_UPGRADE", "You already have this plan or higher.");
  }

  const origin = appOriginFromRequest(request);
  const priceId = priceIdForTargetPlan(billing, targetPlan);

  try {
    const stripe = stripeClient(billing.secretKey);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/bgos?checkout=success`,
      cancel_url: `${origin}/bgos?checkout=cancelled`,
      client_reference_id: company.id,
      metadata: {
        companyId: company.id,
        userId: session.sub,
        targetPlan: targetPlan === PLAN.ENTERPRISE ? "ENTERPRISE" : "PRO",
      },
    });

    const url = checkout.url;
    if (!url) {
      return jsonError(500, "CHECKOUT_FAILED", "Could not start checkout");
    }
    return jsonSuccess({ url });
  } catch (e) {
    return handleApiError("POST /api/payment/checkout", e);
  }
}
