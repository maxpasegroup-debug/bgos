"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SalesNetworkRole } from "@prisma/client";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { BossControlDashboard } from "@/components/internal/dashboards/BossControlDashboard";

type Ctx = {
  ok: true;
  sales_network_role: SalesNetworkRole | null;
  is_super_boss: boolean;
};

export function InternalControlEntry() {
  const router = useRouter();
  const [ctx, setCtx] = useState<Ctx | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/internal/context", { credentials: "include" });
      const j = (await readApiJson(res, "ctl-ctx")) as Ctx & { ok?: boolean };
      if (!res.ok || !j.ok) return;
      if (!cancelled) setCtx(j);

      if (j.is_super_boss || j.sales_network_role === SalesNetworkRole.BOSS) {
        return;
      }
      if (j.sales_network_role === SalesNetworkRole.TECH_EXEC) {
        router.replace("/internal/tech");
        return;
      }
      router.replace("/internal/sales");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ctx) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/60">
        Loading control plane…
      </div>
    );
  }

  if (ctx.is_super_boss || ctx.sales_network_role === SalesNetworkRole.BOSS) {
    return <BossControlDashboard />;
  }

  return null;
}
