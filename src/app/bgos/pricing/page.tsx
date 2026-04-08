import type { Metadata } from "next";
import { BgosPricingPageClient } from "@/components/bgos/BgosPricingPageClient";

export const metadata: Metadata = {
  title: "Plans & pricing | BGOS",
  description: "Compare Basic, Pro, and Enterprise for BGOS — CRM, billing, Nexa, and automation.",
};

export default function BgosPricingPage() {
  return <BgosPricingPageClient />;
}
