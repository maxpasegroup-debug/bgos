import { redirect } from "next/navigation";
import { IceconnectInventoryDashboard } from "@/components/iceconnect/IceconnectInventoryDashboard";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectInventoryPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/inventory");
  if (!canAccessIceconnectDashboard("inventory", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectInventoryDashboard />;
}
