"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? "";

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.appendChild(s);
  });
}

type StatusJson = {
  ok?: boolean;
  businessType?: string;
  subscriptionStatus?: string;
  plan?: string;
  customFormComplete?: boolean;
  error?: string;
};

function planToCheckout(plan: string | undefined): "basic" | "pro" | "enterprise" {
  if (plan === "PRO") return "pro";
  if (plan === "ENTERPRISE") return "enterprise";
  return "basic";
}

export function CustomOnboardingPayClient() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [planLabel, setPlanLabel] = useState<string>("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/custom/status", { credentials: "include" });
      const j = (await res.json()) as StatusJson;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load account status.");
        return;
      }
      if (j.businessType !== "CUSTOM") {
        router.replace("/onboarding/nexa");
        return;
      }
      if (j.subscriptionStatus !== "PAYMENT_PENDING") {
        router.replace(j.customFormComplete ? "/bgos" : "/onboarding/custom");
        return;
      }
      setPlanLabel(j.plan === "PRO" ? "Pro" : j.plan === "ENTERPRISE" ? "Enterprise" : "Basic");
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, [router]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const pay = useCallback(async () => {
    if (!RAZORPAY_KEY) {
      setErr("Payments are not configured (NEXT_PUBLIC_RAZORPAY_KEY_ID).");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const st = await apiFetch("/api/onboarding/custom/status", { credentials: "include" });
      const sj = (await st.json()) as StatusJson;
      if (!st.ok || !sj.ok || sj.subscriptionStatus !== "PAYMENT_PENDING") {
        setBusy(false);
        setErr("Payment is not required right now.");
        await load();
        return;
      }
      const plan = planToCheckout(sj.plan);
      await loadRazorpayScript();
      const orderRes = await apiFetch("/api/payment/razorpay/order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const orderJson = (await orderRes.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        data?: { order_id?: string; amount?: number; currency?: string };
      };
      if (!orderRes.ok) {
        setBusy(false);
        setErr(orderJson.message ?? orderJson.error ?? "Could not create order.");
        return;
      }
      const orderId = orderJson.order_id ?? orderJson.data?.order_id;
      const amount = orderJson.amount ?? orderJson.data?.amount;
      const currency = orderJson.currency ?? orderJson.data?.currency ?? "INR";
      if (!orderId || typeof amount !== "number") {
        setBusy(false);
        setErr("Invalid order response.");
        return;
      }

      const meRes = await apiFetch("/api/auth/me", { credentials: "include" });
      const meJson = (await meRes.json()) as { user?: { name?: string; email?: string } };
      const prefillName = (meJson.user?.name ?? "").trim() || "Customer";
      const prefillEmail = (meJson.user?.email ?? "").trim() || "customer@example.com";

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) {
        setBusy(false);
        setErr("Razorpay failed to load.");
        return;
      }

      const rzp = new RazorpayCtor({
        key: RAZORPAY_KEY,
        amount,
        currency,
        order_id: orderId,
        name: "BGOS",
        description: `Custom workspace — ${plan} monthly`,
        prefill: { name: prefillName, email: prefillEmail },
        handler: (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          void (async () => {
            try {
              const vRes = await apiFetch("/api/payment/razorpay/verify", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              if (!vRes.ok) {
                const vJson = (await vRes.json()) as { message?: string; error?: string };
                setErr(vJson.message ?? vJson.error ?? "Verification failed.");
                setBusy(false);
                return;
              }
              await apiFetch("/api/auth/refresh-session", { method: "POST", credentials: "include" });
              setBusy(false);
              router.replace("/onboarding/custom");
              router.refresh();
            } catch {
              setBusy(false);
              setErr("Could not verify payment.");
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
          },
        },
      });
      rzp.open();
    } catch {
      setBusy(false);
      setErr("Checkout failed.");
    }
  }, [load, router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Complete payment</h1>
      <p className="mt-2 text-sm text-white/65">
        Custom dashboards require an active paid plan. You selected <strong className="text-white">{planLabel || "…"}</strong>.
        After payment you&apos;ll fill the short requirements form.
      </p>
      {err ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void pay()}
        className="mt-8 w-full rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
      >
        {busy ? "Opening checkout…" : "Pay securely with Razorpay"}
      </button>
    </div>
  );
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}
