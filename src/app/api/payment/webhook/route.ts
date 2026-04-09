import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma, CompanySubscriptionStatus, type CompanyPlan } from "@prisma/client";
import type Stripe from "stripe";
import {
  getBillingStripeEnv,
  priceIdForTargetPlan,
  stripeClient,
  targetPlanFromMetadata,
} from "@/lib/billing-stripe";
import { planRank } from "@/lib/company-plan-values";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";

export const runtime = "nodejs";

/**
 * Stripe billing webhook — verifies signature, re-fetches Checkout Session, applies plan upgrade once.
 *
 * Configure `STRIPE_WEBHOOK_SECRET` and point Stripe to `POST /api/payment/webhook` on your BGOS origin.
 */
export async function POST(request: NextRequest) {
  const billing = getBillingStripeEnv();
  if (!billing) {
    return jsonError(
      503,
      "BILLING_UNAVAILABLE",
      "Webhook handler not configured (missing Stripe env).",
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError(400, "MISSING_SIGNATURE", "Missing Stripe-Signature header");
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Could not read body");
  }

  const stripe = stripeClient(billing.secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, billing.webhookSecret);
  } catch {
    return jsonError(400, "INVALID_SIGNATURE", "Invalid webhook signature");
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    const full = await stripe.checkout.sessions.retrieve(session.id);

    if (full.payment_status !== "paid") {
      return NextResponse.json({ received: true, skipped: "not_paid" });
    }

    const companyId = full.metadata?.companyId?.trim();
    const targetPlan = targetPlanFromMetadata(full.metadata?.targetPlan);

    if (!companyId || !targetPlan) {
      return NextResponse.json({ received: true, skipped: "missing_metadata" });
    }

    const expectedPriceId = priceIdForTargetPlan(billing, targetPlan);
    const listed = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    const firstPriceId = listed.data[0]?.price?.id ?? null;

    if (firstPriceId !== expectedPriceId) {
      return NextResponse.json({ received: true, skipped: "price_mismatch" });
    }

    if (typeof full.amount_total === "number" && full.amount_total <= 0) {
      return NextResponse.json({ received: true, skipped: "zero_amount" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, plan: true },
    });
    if (!company) {
      return NextResponse.json({ received: true, skipped: "unknown_company" });
    }

    if (planRank(targetPlan) <= planRank(company.plan as CompanyPlan)) {
      return NextResponse.json({ received: true, skipped: "already_at_tier" });
    }

    try {
      const now = new Date();
      const subscriptionPeriodEnd = new Date(now);
      subscriptionPeriodEnd.setUTCDate(subscriptionPeriodEnd.getUTCDate() + 30);

      await prisma.$transaction([
        prisma.billingWebhookEvent.create({
          data: {
            provider: "stripe",
            externalId: event.id,
            eventType: event.type,
          },
        }),
        prisma.company.update({
          where: { id: companyId },
          data: {
            plan: targetPlan as CompanyPlan,
            isTrialActive: false,
            subscriptionStatus: CompanySubscriptionStatus.ACTIVE,
            subscriptionPeriodStart: now,
            subscriptionPeriodEnd,
          },
        }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw e;
    }

    return NextResponse.json({ received: true, upgraded: true });
  } catch (e) {
    return handleApiError("POST /api/payment/webhook", e);
  }
}
