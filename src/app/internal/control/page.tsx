import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole, internalRoleCanAccess } from "@/lib/internal-auth";
import { BossDashboard } from "@/components/internal/BossDashboard";

export const dynamic = "force-dynamic";

export default async function InternalControlPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  if (!internalRoleCanAccess(internalUser.salesNetworkRole, "/internal/control")) {
    redirect("/internal/sales");
  }

  return <BossDashboard />;
}
