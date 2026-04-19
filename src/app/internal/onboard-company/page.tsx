import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole, internalRoleCanAccess } from "@/lib/internal-auth";
import { OnboardCompanyForm } from "@/components/internal/OnboardCompanyForm";

export const dynamic = "force-dynamic";

export default async function InternalOnboardCompanyPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  if (!internalRoleCanAccess(internalUser.salesNetworkRole, "/internal/onboard-company")) {
    redirect("/internal/sales");
  }

  return <OnboardCompanyForm />;
}
