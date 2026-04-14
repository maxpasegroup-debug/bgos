"use client";


import { apiFetch } from "@/lib/api-fetch";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useBgosDashboardContext } from "./BgosDataProvider";

function BgosCheckoutSuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refetch } = useBgosDashboardContext();
  const [toast, setToast] = useState<{ text: string; kind: "success" | "info" } | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success" && checkout !== "cancelled") return;

    let cancelled = false;

    async function run() {
      if (checkout === "success") {
        try {
          await apiFetch("/api/auth/refresh-session", { method: "POST", credentials: "include" });
          if (!cancelled) refetch();
        } catch {
          /* still show toast; user can refresh */
        }
        if (!cancelled) {
          setToast({ text: "Payment successful — your workspace is on the new plan.", kind: "success" });
        }
      } else if (!cancelled) {
        setToast({ text: "Checkout was cancelled. You can upgrade anytime.", kind: "info" });
      }
      router.replace("/bgos", { scroll: false });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router, refetch]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const box =
    toast.kind === "success"
      ? "border-emerald-400/25 bg-emerald-950/95 text-emerald-100"
      : "border-white/15 bg-[#141a28]/95 text-white/85";

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-[90] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-sm shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)] backdrop-blur-md ${box}`}
    >
      {toast.text}
    </div>
  );
}

export function BgosCheckoutSuccess() {
  return (
    <Suspense fallback={null}>
      <BgosCheckoutSuccessInner />
    </Suspense>
  );
}
