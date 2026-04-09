import type { Metadata } from "next";
import { BgosSubscriptionPageClient } from "@/components/bgos/BgosSubscriptionPageClient";

export const metadata: Metadata = {
  title: "Subscription | BGOS",
  description: "Your BGOS plan, trial status, and upgrades.",
};

export default function BgosSubscriptionPage() {
  return <BgosSubscriptionPageClient />;
}
