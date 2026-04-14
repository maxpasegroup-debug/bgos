"use client";

import { apiFetch } from "@/lib/api-fetch";

export type StripeCheckoutPlan = "PRO" | "ENTERPRISE";

export async function fetchStripeCheckoutUrl(plan: StripeCheckoutPlan): Promise<
  { ok: true; url: string } | { ok: false; message: string }
> {
  const res = await apiFetch("/api/payment/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const j = (await res.json()) as {
    ok?: boolean;
    data?: { url?: string };
    url?: string;
    message?: string;
    error?: string;
  };

  const url = j.data?.url ?? j.url;
  if (!res.ok || !url) {
    return { ok: false, message: j.message ?? j.error ?? "Could not start checkout." };
  }
  return { ok: true, url };
}
