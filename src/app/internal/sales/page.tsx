import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole, internalRoleCanAccess } from "@/lib/internal-auth";
import { SalesPageRouter } from "@/components/internal/SalesPageRouter";

export const dynamic = "force-dynamic";

export default async function InternalSalesPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  if (!internalRoleCanAccess(internalUser.salesNetworkRole, "/internal/sales")) {
    redirect("/internal/control");
  }

  return <SalesPageRouter />;
}
