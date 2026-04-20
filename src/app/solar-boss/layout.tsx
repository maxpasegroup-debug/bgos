import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { EmployeeDomain, UserRole } from "@prisma/client";
import { SolarBossShell } from "@/components/solar-boss/SolarBossShell";
import { getAuthUserFromCookies } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Solar Boss",
  robots: { index: false, follow: false },
};

const glass = {
  padding: "18px 20px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
} as const;

export default async function SolarBossLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUserFromCookies();
  if (!user) {
    redirect("/login?from=/solar-boss");
  }
  if (user.role !== UserRole.ADMIN || user.employeeDomain !== EmployeeDomain.SOLAR) {
    redirect("/login?reason=unauthorized");
  }
  return <SolarBossShell>{children}</SolarBossShell>;
}
