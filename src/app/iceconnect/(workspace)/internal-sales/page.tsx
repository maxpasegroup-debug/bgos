import { redirect } from "next/navigation";
import { InternalSalesWorkspace } from "@/components/internal-sales/InternalSalesWorkspace";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectInternalSalesPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/internal-sales");
  if (!canAccessIceconnectDashboard("internal-sales", user.role)) {
    redirect(getRoleHome(user.role));
  }
  const boss = user.role === "ADMIN" || user.role === "MANAGER";
  return <InternalSalesWorkspace variant={boss ? "boss" : "rep"} theme="ice" />;
}
