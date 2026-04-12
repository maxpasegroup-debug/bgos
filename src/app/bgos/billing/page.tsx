import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BgosBillingPageClient } from "@/components/bgos/BgosBillingPageClient";
import { getAuthUserFromCookies } from "@/lib/auth";
import { isBgosProductionBossBypassEmail } from "@/lib/bgos-production-boss-bypass";

export const metadata: Metadata = {
  title: "Billing | BGOS",
  description: "Plan, billing cycle, and invoice PDFs.",
};

export default async function BgosBillingPage() {
  const user = await getAuthUserFromCookies();
  if (user && isBgosProductionBossBypassEmail(user.email)) {
    redirect("/bgos");
  }
  return <BgosBillingPageClient />;
}
