import { redirect } from "next/navigation";
import { IceconnectSalesOnboardingClient } from "@/components/iceconnect/sales-hub/IceconnectSalesOnboardingClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectOnboardingPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/onboarding");
  if (!canAccessIceconnectDashboard("onboarding", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectSalesOnboardingClient />;
}
