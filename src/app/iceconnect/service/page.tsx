import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectServiceDashboard } from "@/components/iceconnect/IceconnectServiceDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectServicePage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/iceconnect/service");
  if (!canAccessIceconnectDashboard("service", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectServiceDashboard />;
}
