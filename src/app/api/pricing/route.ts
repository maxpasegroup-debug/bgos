import { NextResponse } from "next/server";
import { DISCOUNTS, PRICING, PRICING_VERSION } from "@/config/pricing";

export async function GET() {
  return NextResponse.json({
    ok: true as const,
    pricingVersion: PRICING_VERSION,
    pricing: PRICING,
    discounts: DISCOUNTS,
  });
}
