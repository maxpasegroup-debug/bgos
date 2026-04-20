import { redirect } from "next/navigation";
import { IceconnectSalesOnboardingClient } from "@/components/iceconnect/IceconnectSalesOnboardingClient";
import { getAuthUserFromCookies } from "@/lib/auth";

export default async function IceconnectSalesOnboardingPage() {
  const user = await getAuthUserFromCookies();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/sales/onboarding");
  if (
    user.employeeSystem !== "ICECONNECT" ||
    (user.iceconnectEmployeeRole !== "RSM" && user.iceconnectEmployeeRole !== "BDM")
  ) {
    redirect("/iceconnect/rsm");
  }
  return <IceconnectSalesOnboardingClient />;
}
