import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BgosProviders } from "@/components/bgos/BgosProviders";
import { getAuthUserFromHeaders } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sales Booster | BGOS",
  description: "Turn conversations into revenue — omni-channel growth engine for BGOS.",
};

export default async function SalesBoosterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/login?from=/sales-booster");
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white antialiased">
      <BgosProviders>{children}</BgosProviders>
    </div>
  );
}
