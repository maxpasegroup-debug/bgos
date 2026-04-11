import { redirect } from "next/navigation";
import { IceconnectOperationsHub } from "@/components/iceconnect/IceconnectOperationsHub";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectOperationsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/operations");
  if (!canAccessIceconnectDashboard("operations", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectOperationsHub />;
}
