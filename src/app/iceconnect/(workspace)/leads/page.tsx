import { redirect } from "next/navigation";
import { IceconnectSalesLeadsClient } from "@/components/iceconnect/sales-hub/IceconnectSalesLeadsClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectLeadsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/leads");
  if (!canAccessIceconnectDashboard("leads", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectSalesLeadsClient />;
}
