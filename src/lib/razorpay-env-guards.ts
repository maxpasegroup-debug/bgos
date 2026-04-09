import type { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getRazorpayServerConfig, type RazorpayServerConfig } from "@/lib/razorpay-billing";

/**
 * Fails closed in production when Razorpay server keys are missing (avoids silent 503s without context).
 */
export function requireRazorpayConfigOr503(): RazorpayServerConfig | NextResponse {
  const c = getRazorpayServerConfig();
  if (c) return c;
  const prod = process.env.NODE_ENV === "production";
  return jsonError(
    503,
    "BILLING_UNAVAILABLE",
    prod
      ? "Razorpay is misconfigured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the host (e.g. Railway)."
      : "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local.",
  );
}

/**
 * Live Razorpay keys must not be used over plain HTTP (Razorpay + PCI best practice).
 */
export function razorpayLiveRequiresHttpsOr400(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  const pub = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? "";
  if (!pub.startsWith("rzp_live_")) return null;
  const fwd = request.headers.get("x-forwarded-proto");
  const url = new URL(request.url);
  const proto = (
    fwd?.split(",")[0]?.trim().toLowerCase() ||
    url.protocol.replace(":", "").toLowerCase()
  ).trim();
  if (proto !== "https") {
    return jsonError(
      400,
      "HTTPS_REQUIRED",
      "Live Razorpay requires HTTPS (e.g. https://bgos.online). Plain HTTP or localhost is not valid for rzp_live_ keys.",
    );
  }
  return null;
}
