import { redirect } from "next/navigation";
import { IceconnectHrDashboard } from "@/components/iceconnect/IceconnectHrDashboard";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectHrPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/hr");
  if (!canAccessIceconnectDashboard("hr", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectHrDashboard />;
}
