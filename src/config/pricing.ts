import { CompanyPlan } from "@prisma/client";

export const PRICING_VERSION = "v1.0" as const;

export const PRICING = {
  BASIC: {
    price: 7000,
    name: "Basic",
    billing: "monthly",
  },
  PRO: {
    price: 12000,
    name: "Pro",
    billing: "monthly",
  },
  ENTERPRISE: {
    price: null,
    name: "Enterprise",
    billing: "custom",
  },
} as const;

const ENTERPRISE_CHECKOUT_FALLBACK_INR = 24000;

export const DISCOUNTS = {
  FESTIVE: { type: "PERCENT" as const, value: 10 },
  CUSTOM: { type: "DYNAMIC" as const, value: null as number | null },
} as const;

type DiscountCode = keyof typeof DISCOUNTS;

export function inrToPaise(amountInr: number): number {
  return Math.round(amountInr * 100);
}

export function inrMonthlyLabel(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}/month`;
}

export function basePlanPriceInr(plan: CompanyPlan): number {
  if (plan === CompanyPlan.BASIC) return PRICING.BASIC.price;
  if (plan === CompanyPlan.PRO) return PRICING.PRO.price;
  return ENTERPRISE_CHECKOUT_FALLBACK_INR;
}

export function priceForPlanPaise(plan: CompanyPlan): number {
  return inrToPaise(basePlanPriceInr(plan));
}

export function applyDiscountToPlanInr(plan: CompanyPlan, discountCode?: string | null): {
  basePriceInr: number;
  finalPriceInr: number;
  appliedDiscountCode: DiscountCode | null;
} {
  const basePriceInr = basePlanPriceInr(plan);
  const code = (discountCode ?? "").trim().toUpperCase() as DiscountCode;
  if (!code || !(code in DISCOUNTS)) {
    return { basePriceInr, finalPriceInr: basePriceInr, appliedDiscountCode: null };
  }
  const d = DISCOUNTS[code];
  if (d.type === "PERCENT") {
    const finalPriceInr = Math.max(0, Math.round(basePriceInr * (1 - d.value / 100)));
    return { basePriceInr, finalPriceInr, appliedDiscountCode: code };
  }
  return { basePriceInr, finalPriceInr: basePriceInr, appliedDiscountCode: null };
}

export const RAZORPAY_PLAN_IDS: Record<CompanyPlan, string | null> = {
  BASIC: process.env.RAZORPAY_PLAN_ID_BASIC?.trim() || null,
  PRO: process.env.RAZORPAY_PLAN_ID_PRO?.trim() || null,
  ENTERPRISE: process.env.RAZORPAY_PLAN_ID_ENTERPRISE?.trim() || null,
};

export function validatePaymentAmountOrThrow(plan: CompanyPlan, amountPaise: number): void {
  const expected = priceForPlanPaise(plan);
  if (amountPaise !== expected) {
    throw new Error(`PRICING_MISMATCH:${plan}:${amountPaise}:${expected}`);
  }
}
