import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole } from "@/lib/internal-auth";
import { BdeAgreementPage } from "@/components/internal/BdeAgreementPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "BDE Agreement — BGOS Internal" };

export default async function InternalBdeAgreementRoute() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  return <BdeAgreementPage />;
}
