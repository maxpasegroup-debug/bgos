"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SalesNetworkRole } from "@prisma/client";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { TechQueueDashboard } from "@/components/internal/dashboards/TechQueueDashboard";

type Ctx = {
  ok: true;
  sales_network_role: SalesNetworkRole | null;
  is_super_boss: boolean;
};

export function InternalTechEntry() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/internal/context", { credentials: "include" });
      const j = (await readApiJson(res, "tech-ctx")) as Ctx & { ok?: boolean };
      if (!res.ok || !j.ok) {
        if (!cancelled) setAllowed(false);
        return;
      }
      const ok =
        j.is_super_boss ||
        j.sales_network_role === SalesNetworkRole.TECH_EXEC ||
        j.sales_network_role === SalesNetworkRole.BOSS;
      if (!cancelled) setAllowed(ok);
      if (!ok) {
        router.replace("/internal/sales");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/60">
        Loading tech workspace…
      </div>
    );
  }

  if (!allowed) return null;

  return <TechQueueDashboard />;
}
