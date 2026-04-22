import { redirect } from "next/navigation";
import { HrDashboard } from "@/components/bgos/hr/HrDashboard";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosHrPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login");
  return <HrDashboard user={user} />;
}
