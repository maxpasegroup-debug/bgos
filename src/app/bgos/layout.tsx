import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BgosProviders } from "@/components/bgos/BgosProviders";
import { getAuthUserFromHeaders } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Command Center | BGOS",
  description: "BGOS — Solar company boss dashboard.",
};

export default async function BgosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/login?from=/bgos");
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white antialiased">
      <BgosProviders>{children}</BgosProviders>
    </div>
  );
}
