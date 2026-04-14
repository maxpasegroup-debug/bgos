import "server-only";

import crypto from "node:crypto";
import { CompanySubscriptionStatus, type CompanyPlan, Prisma } from "@prisma/client";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";

/** ₹6,000 / month in paise */
export const RAZORPAY_BASIC_MONTHLY_PAISE = 600_000;
/** ₹12,000 / month in paise */
export const RAZORPAY_PRO_MONTHLY_PAISE = 1_200_000;
/** ₹24,000 / month in paise — custom enterprise tier checkout */
export const RAZORPAY_ENTERPRISE_MONTHLY_PAISE = 2_400_000;

const SUBSCRIPTION_PERIOD_DAYS = 30;

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
  /**
   * HMAC key for **raw webhook body** (Dashboard → Webhooks → secret).
   * If `RAZORPAY_WEBHOOK_SECRET` is unset, falls back to `RAZORPAY_KEY_SECRET` (common in tutorials;
   * prefer a dedicated webhook secret in production).
   */
  webhookSigningSecret: string;
};

export function getRazorpayServerConfig(): RazorpayServerConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  const webhookDedicated = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const webhookSigningSecret =
    webhookDedicated && webhookDedicated.length > 0 ? webhookDedicated : keySecret;
  return { keyId, keySecret, webhookSigningSecret };
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch (e) {
    console.error("ERROR:razorpay.verifyPaymentSignature", e);
    return false;
  }
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch (e) {
    console.error("ERROR:razorpay.verifyWebhookSignature", e);
    return false;
  }
}

export function razorpayAmountForPlan(plan: CompanyPlan): number {
  if (plan === "ENTERPRISE") return RAZORPAY_ENTERPRISE_MONTHLY_PAISE;
  if (plan === "PRO") return RAZORPAY_PRO_MONTHLY_PAISE;
  return RAZORPAY_BASIC_MONTHLY_PAISE;
}

type OrderNotes = {
  userId: string;
  companyId: string;
  plan: CompanyPlan;
};

function parseOrderNotes(notes: unknown): OrderNotes | null {
  if (!notes || typeof notes !== "object") return null;
  const o = notes as Record<string, unknown>;
  const userId = typeof o.userId === "string" ? o.userId.trim() : "";
  const companyId = typeof o.companyId === "string" ? o.companyId.trim() : "";
  const planRaw = typeof o.plan === "string" ? o.plan.trim().toUpperCase() : "";
  const plan =
    planRaw === "PRO"
      ? ("PRO" as CompanyPlan)
      : planRaw === "BASIC"
        ? ("BASIC" as CompanyPlan)
        : planRaw === "ENTERPRISE"
          ? ("ENTERPRISE" as CompanyPlan)
          : null;
  if (!userId || !companyId || !plan) return null;
  return { userId, companyId, plan };
}

/**
 * Idempotent: if `razorpayPaymentId` already recorded, returns without changing the company.
 */
export async function applySuccessfulRazorpayPayment(input: {
  companyId: string;
  userId: string;
  targetPlan: CompanyPlan;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency: string;
}): Promise<{ applied: boolean }> {
  let applied = false;
  await prisma.$transaction(async (tx) => {
    // Idempotency: same Razorpay payment id must never activate twice (webhook + verify retries).
    const dup = await tx.razorpayPayment.findUnique({
      where: { razorpayPaymentId: input.razorpayPaymentId },
    });
    if (dup) return;

    const company = await tx.company.findUnique({
      where: { id: input.companyId },
      select: { subscriptionPeriodEnd: true },
    });
    if (!company) {
      throw new Error("Company not found");
    }

    const now = new Date();
    const base =
      company.subscriptionPeriodEnd && company.subscriptionPeriodEnd.getTime() > now.getTime()
        ? company.subscriptionPeriodEnd
        : now;
    const end = new Date(base);
    end.setUTCDate(end.getUTCDate() + SUBSCRIPTION_PERIOD_DAYS);

    await tx.razorpayPayment.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        plan: input.targetPlan,
        amount: input.amountPaise,
        currency: input.currency.toUpperCase() || "INR",
        status: "completed",
      },
    });

    await tx.company.update({
      where: { id: input.companyId },
      data: {
        plan: input.targetPlan,
        subscriptionStatus: CompanySubscriptionStatus.ACTIVE,
        isTrialActive: false,
        subscriptionPeriodStart: now,
        subscriptionPeriodEnd: end,
      },
    });
    applied = true;
  });
  return { applied };
}

export function decodeRazorpayOrderNotes(notes: unknown): OrderNotes | null {
  return parseOrderNotes(notes);
}

export type NormalizedRazorpayPaymentCaptured = {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
};

export type NormalizedRazorpayPaymentFailed = {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
};

/** Best-effort parse of `payment.failed` webhook JSON. */
export function parsePaymentFailedPayload(raw: unknown): NormalizedRazorpayPaymentFailed | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  if (root.event !== "payment.failed") return null;
  const payload = root.payload;
  if (!payload || typeof payload !== "object") return null;
  const payWrap = (payload as Record<string, unknown>).payment;
  if (!payWrap || typeof payWrap !== "object") return null;
  const ent = (payWrap as Record<string, unknown>).entity;
  if (!ent || typeof ent !== "object") return null;
  const e = ent as Record<string, unknown>;
  const paymentId = typeof e.id === "string" ? e.id : "";
  const orderId = typeof e.order_id === "string" ? e.order_id : "";
  const amount = typeof e.amount === "number" ? e.amount : Number(e.amount);
  const currency = typeof e.currency === "string" ? e.currency : "INR";
  if (!orderId || !Number.isFinite(amount)) return null;
  return { paymentId, orderId, amountPaise: amount, currency };
}

/**
 * Persist failed payment against the checkout order (status `failed`). Idempotent on `razorpayOrderId`.
 */
export async function recordRazorpayPaymentFailed(normalized: NormalizedRazorpayPaymentFailed): Promise<boolean> {
  const billing = getRazorpayServerConfig();
  if (!billing) return false;

  try {
    const rz = new Razorpay({ key_id: billing.keyId, key_secret: billing.keySecret });
    const order = await rz.orders.fetch(normalized.orderId);
    const notes = decodeRazorpayOrderNotes(order.notes);
    if (!notes) {
      console.warn("[razorpay] payment.failed: order notes missing", normalized.orderId);
      return false;
    }

    const company = await prisma.company.findUnique({
      where: { id: notes.companyId },
      select: { ownerId: true },
    });
    if (!company) return false;

    const userId = notes.userId.length > 0 ? notes.userId : company.ownerId;

    await prisma.razorpayPayment.upsert({
      where: { razorpayOrderId: normalized.orderId },
      create: {
        companyId: notes.companyId,
        userId,
        razorpayOrderId: normalized.orderId,
        razorpayPaymentId: normalized.paymentId || null,
        plan: notes.plan,
        amount: normalized.amountPaise,
        currency: normalized.currency.toUpperCase() || "INR",
        status: "failed",
      },
      update: {
        ...(normalized.paymentId ? { razorpayPaymentId: normalized.paymentId } : {}),
        status: "failed",
      },
    });
    return true;
  } catch (e) {
    console.error("ERROR:razorpay.recordRazorpayPaymentFailed", e);
    return false;
  }
}

/** Best-effort parse of `payment.captured` webhook JSON (Node route only). */
export function parsePaymentCapturedPayload(raw: unknown): NormalizedRazorpayPaymentCaptured | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  if (root.event !== "payment.captured") return null;
  const payload = root.payload;
  if (!payload || typeof payload !== "object") return null;
  const payWrap = (payload as Record<string, unknown>).payment;
  if (!payWrap || typeof payWrap !== "object") return null;
  const ent = (payWrap as Record<string, unknown>).entity;
  if (!ent || typeof ent !== "object") return null;
  const e = ent as Record<string, unknown>;
  const paymentId = typeof e.id === "string" ? e.id : "";
  const orderId = typeof e.order_id === "string" ? e.order_id : "";
  const amount = typeof e.amount === "number" ? e.amount : Number(e.amount);
  const currency = typeof e.currency === "string" ? e.currency : "INR";
  if (!paymentId || !orderId || !Number.isFinite(amount)) return null;
  return { paymentId, orderId, amountPaise: amount, currency };
}

export async function recordRazorpayWebhookDedup(eventId: string, eventType: string): Promise<boolean> {
  try {
    await prisma.billingWebhookEvent.create({
      data: {
        provider: "razorpay",
        externalId: eventId,
        eventType,
      },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return false;
    }
    throw e;
  }
}
