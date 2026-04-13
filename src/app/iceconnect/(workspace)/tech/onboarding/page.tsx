import { redirect } from "next/navigation";
import { TechOnboardingListClient } from "@/components/onboarding-workflow/TechOnboardingListClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectTechOnboardingPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/tech/onboarding");
  if (!canAccessIceconnectDashboard("tech-onboarding", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <TechOnboardingListClient />;
}
