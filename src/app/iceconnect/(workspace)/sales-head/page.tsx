import { redirect } from "next/navigation";
import { IceconnectRoleModulePage } from "@/components/iceconnect/IceconnectRoleModulePage";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectSalesHeadPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/sales-head");
  if (!canAccessIceconnectDashboard("sales-head", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return (
    <IceconnectRoleModulePage
      title="Sales Head Workspace"
      subtitle="Team pipeline monitoring and approvals."
      tools={["Team pipeline review", "Lead quality checks", "Escalation handling", "Conversion oversight"]}
    />
  );
}
