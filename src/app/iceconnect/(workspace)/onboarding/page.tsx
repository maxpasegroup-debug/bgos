import { redirect } from "next/navigation";
import { NexaUnifiedOnboardingClient } from "@/components/onboarding/NexaUnifiedOnboardingClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectOnboardingPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/onboarding");
  if (!canAccessIceconnectDashboard("onboarding", user.role)) {
    redirect(getRoleHome(user.role));
  }
  const displayName = user.email?.split("@")[0] || "there";
  return <NexaUnifiedOnboardingClient source="SALES" employeeName={displayName} />;
}
