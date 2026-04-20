import { redirect } from "next/navigation";
import { IceconnectTechOnboardingRequestsClient } from "@/components/iceconnect/IceconnectTechOnboardingRequestsClient";
import { getAuthUserFromCookies } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectTechOnboardingPage() {
  const user = await getAuthUserFromCookies();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/tech/onboarding");
  if (!canAccessIceconnectDashboard("tech-onboarding", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectTechOnboardingRequestsClient />;
}
