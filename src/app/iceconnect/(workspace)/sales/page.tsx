import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectSalesDashboard } from "@/components/iceconnect/IceconnectSalesDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectSalesPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/sales");
  if (!canAccessIceconnectDashboard("sales", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectSalesDashboard />;
}
