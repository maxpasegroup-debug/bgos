import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { EmployeeDomain, UserRole } from "@prisma/client";
import { SolarBossNav } from "@/components/bgos/solar/SolarBossNav";
import { getAuthUserFromCookies } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Solar Boss",
  robots: { index: false, follow: false },
};

export default async function SolarBossLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUserFromCookies();
  if (!user) {
    redirect("/login?from=/solar-boss");
  }
  if (user.role !== UserRole.ADMIN || user.employeeDomain !== EmployeeDomain.SOLAR) {
    redirect("/login?reason=unauthorized");
  }
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg, #05070c 0%, #0a1018 45%, #06090e 100%)", color: "rgba(255,255,255,0.92)" }}>
      <SolarBossNav />
      <main className="md:ml-64" style={{ padding: "14px 14px 32px" }}>
        {children}
      </main>
    </div>
  );
}
