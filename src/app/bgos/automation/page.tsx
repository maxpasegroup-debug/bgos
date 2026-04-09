import { redirect } from "next/navigation";
import { BgosAutomationPageClient } from "@/components/bgos/automation/BgosAutomationPageClient";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosAutomationPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/automation");
  if (!user.companyId) redirect("/bgos");
  return <BgosAutomationPageClient />;
}
