"use client";

import { apiFetch } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchStripeCheckoutUrl } from "@/lib/stripe-plan-checkout";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { useBgosDashboardContext } from "@/components/bgos/BgosDataProvider";

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

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

/** Non-Pro Sales Booster — upgrade funnel (inside dashboard shell via layout). */
export function SalesBoosterUpgradeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { planLockedToBasic } = useBgosDashboardContext();
  const [upgrading, setUpgrading] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      setBanner({ kind: "ok", text: "Plan activated — Sales Booster Pro is ready." });
      router.replace("/sales-booster", { scroll: false });
    }
  }, [searchParams, router]);

  const runProUpgrade = useCallback(async () => {
    if (planLockedToBasic) {
      setBanner({ kind: "err", text: "Upgrades are not available in this environment." });
      return;
    }
    setUpgrading(true);
    setBanner(null);
    try {
      if (!RAZORPAY_KEY) {
        const stripe = await fetchStripeCheckoutUrl("PRO");
        setUpgrading(false);
        if (!stripe.ok) {
          setBanner({ kind: "err", text: stripe.message });
          return;
        }
        window.location.assign(stripe.url);
        return;
      }

      await loadRazorpayScript();
      const orderRes = await apiFetch("/api/payment/razorpay/order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
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
        setUpgrading(false);
        setBanner({
          kind: "err",
          text: orderJson.message ?? orderJson.error ?? "Could not create payment order.",
        });
        return;
      }
      const orderId = orderJson.order_id ?? orderJson.data?.order_id;
      const amount = orderJson.amount ?? orderJson.data?.amount;
      const currency = orderJson.currency ?? orderJson.data?.currency ?? "INR";
      if (!orderId || typeof amount !== "number") {
        setUpgrading(false);
        setBanner({ kind: "err", text: "Invalid order response from server." });
        return;
      }

      const meRes = await apiFetch("/api/auth/me", { credentials: "include" });
      const meJson = (await meRes.json()) as { user?: { name?: string; email?: string } };
      const prefillName = (meJson.user?.name ?? "").trim() || "Customer";
      const prefillEmail = (meJson.user?.email ?? "").trim() || "customer@example.com";

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) {
        setUpgrading(false);
        setBanner({ kind: "err", text: "Razorpay failed to load. Refresh and try again." });
        return;
      }

      const rzp = new RazorpayCtor({
        key: RAZORPAY_KEY,
        amount,
        currency,
        order_id: orderId,
        name: "BGOS",
        description: "Pro — Sales Booster",
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
              const vJson = (await vRes.json()) as { message?: string; error?: string };
              if (!vRes.ok) {
                setUpgrading(false);
                setBanner({
                  kind: "err",
                  text: vJson.message ?? vJson.error ?? "Payment verification failed.",
                });
                return;
              }
              await apiFetch("/api/auth/refresh-session", { method: "POST", credentials: "include" });
              setUpgrading(false);
              window.location.assign("/sales-booster?upgraded=1");
            } catch {
              setUpgrading(false);
              setBanner({
                kind: "err",
                text: "Could not verify payment. Contact support if you were charged.",
              });
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setBanner({ kind: "err", text: "Payment cancelled — you can try again when you’re ready." });
          },
        },
      });
      setUpgrading(false);
      rzp.open();
    } catch {
      setUpgrading(false);
      setBanner({ kind: "err", text: "Checkout could not start. Try again." });
    }
  }, [planLockedToBasic]);

  const sections = [
    { title: "Omnichannel Inbox", desc: "One place for WhatsApp, social, and email — never miss a lead." },
    { title: "Automation", desc: "Simple flows that greet, qualify, and route while you sell." },
    { title: "Campaigns", desc: "Reach customers on the channel they prefer with clear results." },
    { title: "Chatbots", desc: "Lightweight bots that feel human — no engineering degree required." },
  ];

  return (
    <div className={`relative min-h-0 flex-1 overflow-y-auto ${BGOS_MAIN_PAD} pb-20 pt-8`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />

      {banner ? (
        <div
          role="status"
          className={
            banner.kind === "ok"
              ? "relative z-10 mx-auto mb-6 max-w-3xl rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100"
              : "relative z-10 mx-auto mb-6 max-w-3xl rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {upgrading ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/15 bg-[#0f172a] px-8 py-6 text-center shadow-xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/40 border-t-cyan-300" />
            <p className="mt-4 text-sm font-medium text-white">Opening checkout…</p>
          </div>
        </div>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Sales Booster</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Turn conversations into revenue — automatically
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-white/55">
          Plug in your channels, reply from one inbox, and launch campaigns without a technical team.
        </p>

        <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-4">
          <ChannelIcon label="WhatsApp" className="text-[#25D366]" icon={<IconWhatsApp />} />
          <ChannelIcon label="Instagram" className="bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] bg-clip-text text-transparent" icon={<IconInstagram />} />
          <ChannelIcon label="Facebook" className="text-[#1877F2]" icon={<IconFacebook />} />
          <ChannelIcon label="Email" className="text-slate-200" icon={<IconEmail />} />
          <ChannelIcon label="SMS" className="text-cyan-300" icon={<IconSms />} />
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={planLockedToBasic}
            onClick={() => void runProUpgrade()}
            className="min-h-[48px] w-full max-w-xs rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 text-sm font-semibold text-white shadow-[0_0_32px_-8px_rgba(34,211,238,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upgrade to Pro
          </button>
          <Link
            href="/bgos/subscription"
            className="text-sm font-medium text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
          >
            View plans
          </Link>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45 }}
        className="relative mx-auto mt-20 max-w-5xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-6 backdrop-blur-sm"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <h2 className="text-base font-semibold text-white">{s.title}</h2>
              <p className="mt-2 text-sm text-white/55">{s.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

function ChannelIcon({
  label,
  icon,
  className,
}: {
  label: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-inner ${className ?? ""}`}
      >
        <span className="h-7 w-7">{icon}</span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
    </div>
  );
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-full w-full">
      <path d="M20.52 3.45A11.87 11.87 0 0012.06 0C5.97 0 .96 5.01.96 11.1c0 1.96.51 3.87 1.48 5.55L.06 24l7.47-1.96a11.82 11.82 0 005.53 1.42h.01c6.09 0 11.1-5.01 11.1-11.1 0-2.97-1.16-5.76-3.27-7.86zM12.07 21.1h-.01a9.1 9.1 0 01-4.65-1.27l-.33-.2-3.45.9.92-3.37-.22-.35a9.08 9.08 0 01-1.39-4.83c0-5.01 4.07-9.08 9.09-9.08 2.43 0 4.71.95 6.42 2.66a9.02 9.02 0 012.66 6.41c0 5.03-4.07 9.1-9.09 9.1z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-full w-full">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-full w-full">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IconEmail() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden className="h-full w-full">
      <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconSms() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden className="h-full w-full">
      <path strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}
