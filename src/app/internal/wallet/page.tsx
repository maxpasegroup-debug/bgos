import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole } from "@/lib/internal-auth";
import { WalletPageRouter } from "@/components/internal/WalletPageRouter";

export const dynamic = "force-dynamic";

export default async function InternalWalletPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  return <WalletPageRouter />;
}
