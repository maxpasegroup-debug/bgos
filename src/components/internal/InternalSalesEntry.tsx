"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SalesNetworkRole } from "@prisma/client";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { BdeSalesDashboard } from "@/components/internal/dashboards/BdeSalesDashboard";
import { BdmSalesDashboard } from "@/components/internal/dashboards/BdmSalesDashboard";
import { RsmSalesDashboard } from "@/components/internal/dashboards/RsmSalesDashboard";

type Ctx = {
  ok: true;
  sales_network_role: SalesNetworkRole | null;
  is_super_boss: boolean;
};

export function InternalSalesEntry() {
  const router = useRouter();
  const [ctx, setCtx] = useState<Ctx | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/internal/context", { credentials: "include" });
      const j = (await readApiJson(res, "sales-entry-ctx")) as Ctx & { ok?: boolean };
      if (!cancelled && res.ok && j.ok) {
        setCtx(j);
        if (j.sales_network_role === SalesNetworkRole.TECH_EXEC && !j.is_super_boss) {
          router.replace("/internal/tech");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ctx) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/60">
        Loading workspace…
      </div>
    );
  }

  if (ctx.is_super_boss) {
    return <RsmSalesDashboard />;
  }

  switch (ctx.sales_network_role) {
    case SalesNetworkRole.BDE:
      return <BdeSalesDashboard />;
    case SalesNetworkRole.BDM:
      return <BdmSalesDashboard />;
    case SalesNetworkRole.RSM:
    case SalesNetworkRole.BOSS:
      return <RsmSalesDashboard />;
    case SalesNetworkRole.TECH_EXEC:
      return null;
    default:
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/80">
          <p className="text-lg font-semibold">Sales desk</p>
          <p className="mt-2 text-sm text-white/60">
            Your account is not mapped to a sales network role yet. Contact platform leadership.
          </p>
        </div>
      );
  }
}
