import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BgosProviders } from "@/components/bgos/BgosProviders";
import { AUTH_HEADER_MW_PATHNAME } from "@/lib/auth-config";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { isSuperBossEmail } from "@/lib/super-boss";

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

  const h = await headers();
  const serverPathname = h.get(AUTH_HEADER_MW_PATHNAME) ?? "";
  const initialSuperBoss = isSuperBossEmail(user.email);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white antialiased">
      <BgosProviders initialSuperBoss={initialSuperBoss} serverPathname={serverPathname}>
        {children}
      </BgosProviders>
    </div>
  );
}
