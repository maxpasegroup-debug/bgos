import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BgosSubscriptionPageClient } from "@/components/bgos/BgosSubscriptionPageClient";
import { getAuthUserFromCookies } from "@/lib/auth";
import { isBgosProductionBossBypassEmail } from "@/lib/bgos-production-boss-bypass";

export const metadata: Metadata = {
  title: "Subscription | BGOS",
  description: "Your BGOS plan, trial status, and upgrades.",
};

export default async function BgosSubscriptionPage() {
  const user = await getAuthUserFromCookies();
  if (user && isBgosProductionBossBypassEmail(user.email)) {
    redirect("/bgos");
  }
  return <BgosSubscriptionPageClient />;
}
