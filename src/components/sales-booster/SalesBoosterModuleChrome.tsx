"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SB_PAGE } from "@/components/sales-booster/salesBoosterUi";
import { IconChevronLeft } from "@/components/sales-booster/SalesBoosterIcons";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

export function SalesBoosterModuleChrome({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-h-0 flex-1 overflow-hidden ${BGOS_MAIN_PAD} pb-12 pt-6`}>
      <div className={SB_PAGE}>
        <div className="mb-6">
          <Link
            href="/sales-booster"
            className="inline-flex items-center gap-1 text-sm font-medium text-cyan-300/90 transition hover:text-cyan-200"
          >
            <IconChevronLeft className="h-4 w-4" />
            Back to Sales Booster
          </Link>
          <h1 className="mt-3 text-xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-white/50">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
