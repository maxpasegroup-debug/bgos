import { redirect } from "next/navigation";
import { MicroFranchisePartnerDashboardClient } from "@/components/micro-franchise/MicroFranchisePartnerDashboardClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function MicroFranchisePartnerPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/micro-franchise");
  if (!canAccessIceconnectDashboard("micro-franchise", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <MicroFranchisePartnerDashboardClient />;
}
