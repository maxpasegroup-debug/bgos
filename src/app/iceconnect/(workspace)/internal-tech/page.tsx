import { redirect } from "next/navigation";
import { InternalTechWorkspace } from "@/components/internal-sales/InternalTechWorkspace";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectInternalTechPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/internal-tech");
  if (!canAccessIceconnectDashboard("internal-tech", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <InternalTechWorkspace theme="ice" />;
}
