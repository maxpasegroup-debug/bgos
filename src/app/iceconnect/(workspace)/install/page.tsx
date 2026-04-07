import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectOperationsDashboard } from "@/components/iceconnect/IceconnectOperationsDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectInstallPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/install");
  if (!canAccessIceconnectDashboard("install", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectOperationsDashboard module="install" />;
}
