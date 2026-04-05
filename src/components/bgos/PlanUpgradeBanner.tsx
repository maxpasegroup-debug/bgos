"use client";

import Link from "next/link";
import { CompanyPlan } from "@prisma/client";

export function PlanUpgradeBanner({ plan }: { plan: CompanyPlan | null }) {
  if (plan !== CompanyPlan.BASIC) return null;

  return (
    <div className="border-b border-[#FFC300]/25 bg-gradient-to-r from-[#FFC300]/10 to-transparent px-4 py-2.5 sm:px-7 lg:px-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/85">
          <span className="font-semibold text-[#FFC300]">Basic plan</span>
          <span className="text-white/50"> — </span>
          Automation, Pro Sales Booster, and{" "}
          <code className="rounded bg-white/10 px-1 text-xs text-white/70">/api/automation</code>{" "}
          are disabled. Upgrade to unlock.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="#sales-booster"
            className="text-xs font-semibold uppercase tracking-wider text-[#FFC300] underline-offset-2 hover:underline"
          >
            See Pro features
          </Link>
          <span className="text-[10px] text-white/35">Contact ICECONNECT to upgrade</span>
        </div>
      </div>
    </div>
  );
}
