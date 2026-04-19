import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole, internalRoleCanAccess } from "@/lib/internal-auth";
import { TechDashboard } from "@/components/internal/TechDashboard";

export const dynamic = "force-dynamic";

export default async function InternalTechPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  if (!internalRoleCanAccess(internalUser.salesNetworkRole, "/internal/tech")) {
    redirect("/internal/sales");
  }

  return <TechDashboard />;
}
