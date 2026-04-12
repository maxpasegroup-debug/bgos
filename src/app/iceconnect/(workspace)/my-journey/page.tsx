import { redirect } from "next/navigation";
import { IceconnectMyJourneyClient } from "@/components/iceconnect/sales-hub/IceconnectMyJourneyClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectMyJourneyPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/my-journey");
  if (!canAccessIceconnectDashboard("my-journey", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return <IceconnectMyJourneyClient />;
}
