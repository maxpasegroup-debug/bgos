import { redirect } from "next/navigation";
import { CompanyPlan } from "@prisma/client";
import { SalesBoosterDashboardClient } from "@/components/sales-booster/SalesBoosterDashboardClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { isPro } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";

export default async function SalesBoosterDashboardPage() {
  const user = await getAuthUserFromHeaders();
  if (!user?.companyId) {
    redirect("/onboarding");
  }

  const row = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { plan: true },
  });
  const plan = row?.plan ?? CompanyPlan.BASIC;
  if (!isPro(plan)) {
    redirect("/sales-booster");
  }

  return <SalesBoosterDashboardClient />;
}
