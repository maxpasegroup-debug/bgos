"use client";

/**
 * SalesPageRouter — selects the correct dashboard component for /internal/sales.
 *
 * Rules:
 *   mobile + BDE  → MobileBdeDashboard (app-like stacked cards)
 *   everything else → SalesDashboard  (desktop, unchanged)
 *
 * Detection is deferred to the first client paint (useEffect) so SSR always
 * renders SalesDashboard and avoids hydration mismatches.
 */

import { useEffect, useState } from "react";
import { SalesNetworkRole } from "@prisma/client";
import { isMobile } from "@/lib/isMobile";
import { useInternalSession } from "@/components/internal/InternalSessionContext";
import { SalesDashboard } from "@/components/internal/SalesDashboard";
import { MobileBdeDashboard } from "@/components/mobile/MobileBdeDashboard";

export function SalesPageRouter() {
  const { salesNetworkRole }    = useInternalSession();
  const [mounted, setMounted]   = useState(false);
  const [mobile,  setMobile]    = useState(false);

  useEffect(() => {
    setMobile(isMobile());
    setMounted(true);

    function onResize() { setMobile(isMobile()); }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Before hydration — render desktop (SSR-safe)
  if (!mounted) return <SalesDashboard />;

  // Mobile BDE view
  if (mobile && salesNetworkRole === SalesNetworkRole.BDE) {
    return <MobileBdeDashboard />;
  }

  // Desktop (or non-BDE mobile) — unchanged
  return <SalesDashboard />;
}
