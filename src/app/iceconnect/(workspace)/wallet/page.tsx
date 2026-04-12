import { redirect } from "next/navigation";
import { IceconnectWalletClient } from "@/components/iceconnect/sales-hub/IceconnectWalletClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectWalletPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/wallet");
  if (!canAccessIceconnectDashboard("wallet", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectWalletClient />;
}
