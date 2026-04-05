import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { IceconnectAccountsDashboard } from "@/components/iceconnect/IceconnectAccountsDashboard";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectAccountsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/accounts");
  if (!canAccessIceconnectDashboard("accounts", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectAccountsDashboard />;
}
