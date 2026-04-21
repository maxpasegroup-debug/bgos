import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { BdmDashboard } from "@/components/iceconnect/BdmDashboard";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BdmPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login");

  const allowed = new Set<UserRole>([UserRole.BDM, UserRole.ADMIN, UserRole.MANAGER]);
  if (!allowed.has(user.role)) {
    redirect("/login");
  }

  return <BdmDashboard user={user} />;
}
