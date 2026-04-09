import type { Metadata } from "next";
import { BgosBillingPageClient } from "@/components/bgos/BgosBillingPageClient";

export const metadata: Metadata = {
  title: "Billing | BGOS",
  description: "Plan, billing cycle, and invoice PDFs.",
};

export default function BgosBillingPage() {
  return <BgosBillingPageClient />;
}
