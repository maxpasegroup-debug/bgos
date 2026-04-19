"use client";

import type { ReactNode } from "react";
import { BgosThemeProvider } from "@/components/bgos/BgosThemeContext";

/** Theme context for reused `/bgos/control/*` screens mounted under `/internal/*` (no full BGOS chrome). */
export function InternalThemeProvider({ children }: { children: ReactNode }) {
  return <BgosThemeProvider>{children}</BgosThemeProvider>;
}
