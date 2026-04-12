"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";

type WalletJson = {
  ok?: boolean;
  monthlyEarningsEligible?: number;
  monthlySalaryFull?: number;
  perSaleAtFullTarget?: number;
  totalConversions?: number;
  totalEarningsEstimate?: number;
  period?: { year: number; month: number };
  code?: string;
  error?: string;
};

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function IceconnectWalletClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();
  const [d, setD] = useState<WalletJson | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/iceconnect/executive/wallet", { credentials: "include" });
      const j = (await res.json()) as WalletJson;
      if (res.status === 403 && j.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load wallet");
        return;
      }
      setD(j);
    } catch {
      setErr("Network error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <p className="mt-1 text-sm text-gray-500">Earnings view (this month)</p>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Monthly eligible</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{inr(d?.monthlyEarningsEligible ?? 0)}</p>
          <p className="mt-1 text-xs text-gray-500">of {inr(d?.monthlySalaryFull ?? 0)} full salary at target</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Per sale (at full target)</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{inr(d?.perSaleAtFullTarget ?? 0)}</p>
          <p className="mt-1 text-xs text-gray-500">If target is 10 and salary ₹30,000 → ₹3,000 each</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:col-span-2"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">All-time conversions</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{d?.totalConversions ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">
            Estimated total at formula: {inr(d?.totalEarningsEstimate ?? 0)} (informational)
          </p>
        </motion.div>
      </div>
    </div>
  );
}
