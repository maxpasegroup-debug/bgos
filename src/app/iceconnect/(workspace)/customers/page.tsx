import { redirect } from "next/navigation";
import { IceconnectCustomersClient } from "@/components/iceconnect/sales-hub/IceconnectCustomersClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectCustomersPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/customers");
  if (!canAccessIceconnectDashboard("customers", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectCustomersClient />;
}
