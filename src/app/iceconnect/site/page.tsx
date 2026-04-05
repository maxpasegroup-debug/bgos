import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectEngineerDashboard } from "@/components/iceconnect/IceconnectEngineerDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectSitePage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/iceconnect/site");
  if (!canAccessIceconnectDashboard("site", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectEngineerDashboard />;
}
