import { redirect } from "next/navigation";
import { IceconnectPartnerDashboard } from "@/components/iceconnect/IceconnectPartnerDashboard";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectPartnerPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/partner");
  if (!canAccessIceconnectDashboard("partner", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectPartnerDashboard />;
}
