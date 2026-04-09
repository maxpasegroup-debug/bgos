import { redirect } from "next/navigation";
import { CompanyPlan } from "@prisma/client";
import { SalesBoosterLandingClient } from "@/components/sales-booster/SalesBoosterLandingClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { isPro } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";

export default async function SalesBoosterLandingRoute() {
  const user = await getAuthUserFromHeaders();
  if (!user?.companyId) {
    redirect("/onboarding");
  }

  const row = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { plan: true },
  });
  const plan = row?.plan ?? CompanyPlan.BASIC;
  if (isPro(plan)) {
    redirect("/sales-booster/dashboard");
  }

  return <SalesBoosterLandingClient />;
}
