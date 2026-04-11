import { redirect } from "next/navigation";
import { InternalOnboardingQueue } from "@/components/internal-sales/InternalOnboardingQueue";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectInternalOnboardingPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/internal-onboarding");
  if (!canAccessIceconnectDashboard("internal-onboarding", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <InternalOnboardingQueue theme="ice" />;
}
