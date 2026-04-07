import { redirect } from "next/navigation";
import { IceconnectOperationsDashboard } from "@/components/iceconnect/IceconnectOperationsDashboard";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectProPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/pro");
  if (!canAccessIceconnectDashboard("pro", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectOperationsDashboard module="approval" />;
}
