import { redirect } from "next/navigation";
import { CompanyPlan } from "@prisma/client";
import { SalesBoosterCampaignsClient } from "@/components/sales-booster/SalesBoosterCampaignsClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { isPro } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";

export default async function SalesBoosterCampaignsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user?.companyId) {
    redirect("/onboarding/nexa");
  }

  const row = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { plan: true },
  });
  if (!isPro(row?.plan ?? CompanyPlan.BASIC)) {
    redirect("/sales-booster");
  }

  return <SalesBoosterCampaignsClient />;
}
