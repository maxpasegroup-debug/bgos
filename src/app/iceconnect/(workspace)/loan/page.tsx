import { redirect } from "next/navigation";
import { IceconnectRoleModulePage } from "@/components/iceconnect/IceconnectRoleModulePage";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectLoanPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/loan");
  if (!canAccessIceconnectDashboard("loan", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return (
    <IceconnectRoleModulePage
      title="Loan Compliance Workspace"
      subtitle="Loan and finance compliance workflow."
      tools={["Loan document checks", "Bank follow-up", "Sanction status", "Compliance milestones"]}
    />
  );
}
