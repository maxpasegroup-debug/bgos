import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CompanyBusinessType } from "@prisma/client";
import Razorpay from "razorpay";
import { z } from "zod";
import { PRICING_VERSION, RAZORPAY_PLAN_IDS } from "@/config/pricing";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { accrueMicroFranchiseCommission } from "@/lib/micro-franchise-commission";
import {
  applySuccessfulRazorpayPayment,
  decodeRazorpayOrderNotes,
  razorpayAmountForPlan,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay-billing";
import { razorpayLiveRequiresHttpsOr400, requireRazorpayConfigOr503 } from "@/lib/razorpay-env-guards";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export const runtime = "nodejs";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const billing = requireRazorpayConfigOr503();
  if (billing instanceof NextResponse) return billing;

  const httpsBlock = razorpayLiveRequiresHttpsOr400(request);
  if (httpsBlock) return httpsBlock;

  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  if (!session.companyId) {
    return jsonError(400, "NEEDS_COMPANY", "No active company.");
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (!verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, billing.keySecret)) {
    return jsonError(400, "INVALID_SIGNATURE", "Payment signature verification failed.");
  }

  try {
    const existing = await prisma.razorpayPayment.findUnique({
      where: { razorpayPaymentId: razorpay_payment_id },
    });
    if (existing) {
      return jsonSuccess({
        duplicate: true as const,
        status: existing.status,
      });
    }

    const rz = new Razorpay({ key_id: billing.keyId, key_secret: billing.keySecret });
    const order = await rz.orders.fetch(razorpay_order_id);
    const notes = decodeRazorpayOrderNotes(order.notes);
    if (!notes) {
      return jsonError(400, "INVALID_ORDER", "Order metadata missing.");
    }
    if (notes.pricingVersion && notes.pricingVersion !== PRICING_VERSION) {
      return jsonError(400, "PRICING_VERSION_MISMATCH", "Pricing version mismatch.");
    }
    const orderNotes = (order.notes && typeof order.notes === "object" ? order.notes : {}) as Record<string, unknown>;
    const orderPlanId = typeof orderNotes.razorpayPlanId === "string" ? orderNotes.razorpayPlanId.trim() : "";
    const expectedPlanId = RAZORPAY_PLAN_IDS[notes.plan] ?? "";
    if (expectedPlanId && orderPlanId && expectedPlanId !== orderPlanId) {
      return jsonError(400, "PLAN_ID_MISMATCH", "Razorpay plan mapping mismatch.");
    }
    if (notes.companyId !== session.companyId || notes.userId !== session.sub) {
      return jsonError(403, "ORDER_MISMATCH", "Order does not belong to this session.");
    }

    const expectedAmount = notes.expectedAmountPaise ?? razorpayAmountForPlan(notes.plan);
    const orderAmount = typeof order.amount === "number" ? order.amount : Number(order.amount);
    if (!Number.isFinite(orderAmount) || orderAmount !== expectedAmount) {
      return jsonError(400, "AMOUNT_MISMATCH", "Order amount does not match plan price.");
    }

    const { applied } = await applySuccessfulRazorpayPayment({
      companyId: notes.companyId,
      userId: notes.userId,
      targetPlan: notes.plan,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amountPaise: orderAmount,
      expectedAmountPaise: expectedAmount,
      currency: typeof order.currency === "string" ? order.currency : "INR",
    });

    const co = await prisma.company.findUnique({
      where: { id: notes.companyId },
      select: { businessType: true, name: true, microFranchisePartnerId: true },
    });

    if (applied && co?.microFranchisePartnerId) {
      await accrueMicroFranchiseCommission({
        companyId: notes.companyId,
        amountPaise: orderAmount,
        paymentRef: razorpay_payment_id,
      });
    }
    if (applied && co?.businessType === CompanyBusinessType.CUSTOM) {
      await prisma.techRequest.create({
        data: {
          roleName: "CUSTOM_BUILD",
          companyId: notes.companyId,
          status: "pending",
          description: `Custom onboarding paid and ready for tech execution (${co.name}).`,
        },
      });
    }

    return jsonSuccess({
      applied,
      plan: notes.plan,
      paymentId: razorpay_payment_id,
      status: "completed",
    });
  } catch (e) {
    return handleApiError("POST /api/payment/razorpay/verify", e);
  }
}
