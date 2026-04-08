import "server-only";

import Stripe from "stripe";

import { PLAN, type PaidPlan } from "@/lib/company-plan-values";

export type BillingStripeEnv = {
  secretKey: string;
  webhookSecret: string;
  pricePro: string;
  priceEnterprise: string;
};

export function getBillingStripeEnv(): BillingStripeEnv | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const pricePro = process.env.STRIPE_PRICE_PRO?.trim();
  const priceEnterprise = process.env.STRIPE_PRICE_ENTERPRISE?.trim();
  if (!secretKey || !webhookSecret || !pricePro || !priceEnterprise) {
    return null;
  }
  return { secretKey, webhookSecret, pricePro, priceEnterprise };
}

export function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export function priceIdForTargetPlan(env: BillingStripeEnv, target: PaidPlan): string {
  return target === PLAN.ENTERPRISE ? env.priceEnterprise : env.pricePro;
}

export function targetPlanFromMetadata(raw: string | undefined | null): PaidPlan | null {
  if (raw === "PRO") return PLAN.PRO;
  if (raw === "ENTERPRISE") return PLAN.ENTERPRISE;
  return null;
}

/** Origin for Checkout success/cancel URLs (prefer explicit site URL in production). */
export function appOriginFromRequest(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  if (host) {
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
