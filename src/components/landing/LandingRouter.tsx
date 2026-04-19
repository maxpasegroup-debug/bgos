"use client";

import { useEffect, useState } from "react";
import { isMobile } from "@/lib/isMobile";
import { Landing } from "@/components/landing/Landing";
import { MobileLanding } from "@/components/mobile/MobileLanding";

/**
 * Renders MobileLanding on narrow viewports and the full desktop Landing
 * on everything else. SSR defaults to Landing to avoid hydration mismatches.
 */
export function LandingRouter() {
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile]   = useState(false);

  useEffect(() => {
    const check = () => setMobile(isMobile());
    check();
    setMounted(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted) return <Landing />;
  if (mobile)   return <MobileLanding />;
  return <Landing />;
}
