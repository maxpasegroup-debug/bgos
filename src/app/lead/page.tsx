import type { Metadata } from "next";
import { PublicLeadCapture } from "@/components/internal-sales/PublicLeadCapture";

export const metadata: Metadata = {
  title: "Add a lead",
  description: "Share your details — our team will reach out.",
};

export default function PublicLeadPage() {
  return <PublicLeadCapture />;
}
