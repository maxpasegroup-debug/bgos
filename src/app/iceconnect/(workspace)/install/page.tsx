import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectInstallerDashboard } from "@/components/iceconnect/IceconnectInstallerDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectInstallPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/install");
  if (!canAccessIceconnectDashboard("install", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectInstallerDashboard />;
}
