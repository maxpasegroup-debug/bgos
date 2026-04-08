import { redirect } from "next/navigation";
import { BgosDocumentsClient } from "@/components/bgos/BgosDocumentsClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectDocumentsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/documents");
  if (!canAccessIceconnectDashboard("documents", user.role)) {
    redirect(getRoleHome(user.role));
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <BgosDocumentsClient vaultContext="iceconnect" />
    </div>
  );
}
