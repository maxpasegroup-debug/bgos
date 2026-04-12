import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { jsonError } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import {
  applySuccessfulRazorpayPayment,
  decodeRazorpayOrderNotes,
  getRazorpayServerConfig,
  parsePaymentCapturedPayload,
  recordRazorpayWebhookDedup,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay-billing";

export const runtime = "nodejs";

/**
 * Razorpay webhook: verify signing secret, handle `payment.captured`, extend subscription (idempotent).
 */
export async function POST(request: NextRequest) {
  const billing = getRazorpayServerConfig();
  if (!billing) {
    return jsonError(
      503,
      "BILLING_UNAVAILABLE",
      "Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).",
    );
  }

  const sig = request.headers.get("x-razorpay-signature");
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Could not read body.");
  }

  if (!verifyRazorpayWebhookSignature(rawBody, sig, billing.webhookSigningSecret)) {
    return jsonError(400, "INVALID_SIGNATURE", "Invalid webhook signature.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid JSON.");
  }

  const root = parsed as Record<string, unknown>;
  const eventType = typeof root.event === "string" ? root.event : "";
  const eventId = typeof root.id === "string" ? root.id : "";

  if (eventType !== "payment.captured") {
    return NextResponse.json({ received: true, ignored: eventType || "unknown" });
  }

  const normalized = parsePaymentCapturedPayload(parsed);
  if (!normalized) {
    return NextResponse.json({ received: true, skipped: "parse" });
  }

  const existingPayment = await prisma.razorpayPayment.findUnique({
    where: { razorpayPaymentId: normalized.paymentId },
  });
  if (existingPayment) {
    if (eventId) {
      await recordRazorpayWebhookDedup(eventId, eventType);
    }
    return NextResponse.json({ received: true, duplicate: true, reason: "payment_id" });
  }

  try {
    const rz = new Razorpay({ key_id: billing.keyId, key_secret: billing.keySecret });
    const order = await rz.orders.fetch(normalized.orderId);
    const notes = decodeRazorpayOrderNotes(order.notes);
    if (!notes) {
      return NextResponse.json({ received: true, skipped: "notes" });
    }

    const company = await prisma.company.findUnique({
      where: { id: notes.companyId },
      select: { id: true, ownerId: true },
    });
    if (!company) {
      return NextResponse.json({ received: true, skipped: "company" });
    }

    const userId = notes.userId && notes.userId.length > 0 ? notes.userId : company.ownerId;

    await applySuccessfulRazorpayPayment({
      companyId: notes.companyId,
      userId,
      targetPlan: notes.plan,
      razorpayOrderId: normalized.orderId,
      razorpayPaymentId: normalized.paymentId,
      amountPaise: normalized.amountPaise,
      currency: normalized.currency,
    });

    if (eventId) {
      await recordRazorpayWebhookDedup(eventId, eventType);
    }

    return NextResponse.json({ received: true, applied: true });
  } catch (e) {
    return handleApiError("POST /api/payment/razorpay/webhook", e);
  }
}
