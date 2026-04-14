"use client";

import type { ReactNode } from "react";
import { BgosAppChrome } from "./BgosAppChrome";
import { BgosDataProvider } from "./BgosDataProvider";
import { BgosThemeProvider } from "./BgosThemeContext";
import { BgosUpgradeModalProvider } from "./BgosUpgradeModalContext";

export function BgosProviders({
  children,
  initialSuperBoss = false,
  serverPathname = "",
}: {
  children: ReactNode;
  initialSuperBoss?: boolean;
  serverPathname?: string;
}) {
  return (
    <BgosThemeProvider>
      <BgosDataProvider initialSuperBoss={initialSuperBoss} serverPathname={serverPathname}>
        <BgosUpgradeModalProvider>
          <BgosAppChrome>{children}</BgosAppChrome>
        </BgosUpgradeModalProvider>
      </BgosDataProvider>
    </BgosThemeProvider>
  );
}
