import { redirect } from "next/navigation";
import { IceconnectProfileClient } from "@/components/iceconnect/sales-hub/IceconnectProfileClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectProfilePage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/profile");
  if (!canAccessIceconnectDashboard("profile", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectProfileClient />;
}
