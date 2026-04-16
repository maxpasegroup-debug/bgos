import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { isBossReady } from "@/lib/boss-ready";
import { NexaUnifiedOnboardingClient } from "@/components/onboarding/NexaUnifiedOnboardingClient";

type Search = { addBusiness?: string };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Search> | Search;
}) {
  const sp = await Promise.resolve(searchParams);
  const allowAddBusiness = sp.addBusiness === "1";
  const user = await getAuthUserFromHeaders();
  if (user && isBossReady(user.role, user.companyId) && !allowAddBusiness) {
    redirect("/bgos/dashboard");
  }
  const displayName = user?.email?.split("@")[0] || "there";
  return <NexaUnifiedOnboardingClient source="DIRECT" employeeName={displayName} />;
}
