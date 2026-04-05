"use client";

import type { ReactNode } from "react";
import { BgosAppChrome } from "./BgosAppChrome";
import { BgosDataProvider } from "./BgosDataProvider";

export function BgosProviders({ children }: { children: ReactNode }) {
  return (
    <BgosDataProvider>
      <BgosAppChrome>{children}</BgosAppChrome>
    </BgosDataProvider>
  );
}
