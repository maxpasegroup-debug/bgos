"use client";

/**
 * MobileWrapper — conditional shell selector.
 *
 * Detects the viewport on the client and chooses the correct shell:
 *   · Mobile (≤ 768 px) → MobileLayout (bottom-nav shell)
 *   · Desktop           → InternalShell (sidebar shell, unchanged)
 *
 * Renders children directly on the server (SSR-safe default) and swaps
 * to the correct shell after the first client paint to avoid hydration
 * mismatches.
 *
 * STRICT: InternalShell and MobileLayout are both untouched by this wrapper.
 */

import { useEffect, useState } from "react";
import { isMobile } from "@/lib/isMobile";
import { InternalShell } from "@/components/internal/InternalShell";
import { MobileLayout } from "@/components/mobile/MobileLayout";

interface MobileWrapperProps {
  children: React.ReactNode;
}

export function MobileWrapper({ children }: MobileWrapperProps) {
  const [mounted, setMounted]   = useState(false);
  const [mobile,  setMobile]    = useState(false);

  useEffect(() => {
    // Detect on mount
    setMobile(isMobile());
    setMounted(true);

    // Keep in sync on resize (orientation change, devtools responsive mode, etc.)
    function handleResize() {
      setMobile(isMobile());
    }
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Before hydration: render the desktop shell (server-rendered HTML)
  if (!mounted) {
    return <InternalShell>{children}</InternalShell>;
  }

  // ── Mobile: dedicated mobile shell
  if (mobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  // ── Desktop: pass through to InternalShell untouched
  return <InternalShell>{children}</InternalShell>;
}
