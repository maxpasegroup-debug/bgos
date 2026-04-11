"use client";

import { InternalSalesBossHub } from "./InternalSalesBossHub";
import { InternalSalesRepMobile } from "./InternalSalesRepMobile";

export function InternalSalesWorkspace({
  variant,
  theme,
}: {
  variant: "boss" | "rep";
  theme: "bgos" | "ice";
}) {
  if (variant === "rep") {
    return <InternalSalesRepMobile theme={theme} />;
  }
  return <InternalSalesBossHub theme={theme} />;
}
