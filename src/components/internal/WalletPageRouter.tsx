"use client";

import { useEffect, useState } from "react";
import { isMobile } from "@/lib/isMobile";
import { WalletDashboard } from "@/components/internal/WalletDashboard";
import { MobileWalletPage } from "@/components/mobile/MobileWalletPage";

/**
 * Renders MobileWalletPage on narrow viewports and WalletDashboard on desktop.
 * SSR defaults to WalletDashboard to avoid hydration mismatches.
 */
export function WalletPageRouter() {
  const [mounted] = useState(() => typeof window !== "undefined");
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? isMobile() : false,
  );

  useEffect(() => {
    const check = () => setMobile(isMobile());
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted) return <WalletDashboard />;
  if (mobile)   return <MobileWalletPage />;
  return <WalletDashboard />;
}
