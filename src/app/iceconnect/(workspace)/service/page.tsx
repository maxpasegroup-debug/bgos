import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectOperationsDashboard } from "@/components/iceconnect/IceconnectOperationsDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectServicePage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/service");
  if (!canAccessIceconnectDashboard("service", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectOperationsDashboard module="service" />;
}
