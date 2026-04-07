import { redirect } from "next/navigation";
import { IceconnectRoleModulePage } from "@/components/iceconnect/IceconnectRoleModulePage";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectOperationsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/operations");
  if (!canAccessIceconnectDashboard("operations", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return (
    <IceconnectRoleModulePage
      title="Operations Head Workspace"
      subtitle="Operational planning and execution control."
      tools={["Installation pipeline", "Site readiness", "Crew coordination", "Risk blockers"]}
    />
  );
}
