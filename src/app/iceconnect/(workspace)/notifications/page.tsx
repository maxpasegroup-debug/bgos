import { redirect } from "next/navigation";
import { IceconnectNotificationsClient } from "@/components/iceconnect/sales-hub/IceconnectNotificationsClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectNotificationsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/notifications");
  if (!canAccessIceconnectDashboard("notifications", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectNotificationsClient />;
}
