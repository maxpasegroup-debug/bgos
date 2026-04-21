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
  const [mounted] = useState(() => typeof window !== "undefined");
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? isMobile() : false,
  );

  useEffect(() => {
    const check = () => setMobile(isMobile());
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted) return <Landing />;
  if (mobile)   return <MobileLanding />;
  return <Landing />;
}
