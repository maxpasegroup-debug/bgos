"use client";

import type { ReactNode } from "react";
import { BgosAppChrome } from "./BgosAppChrome";
import { BgosDataProvider } from "./BgosDataProvider";
import { BgosThemeProvider } from "./BgosThemeContext";
import { BgosUpgradeModalProvider } from "./BgosUpgradeModalContext";

export function BgosProviders({ children }: { children: ReactNode }) {
  return (
    <BgosThemeProvider>
      <BgosDataProvider>
        <BgosUpgradeModalProvider>
          <BgosAppChrome>{children}</BgosAppChrome>
        </BgosUpgradeModalProvider>
      </BgosDataProvider>
    </BgosThemeProvider>
  );
}
