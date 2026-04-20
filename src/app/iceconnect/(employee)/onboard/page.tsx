import { redirect } from "next/navigation";
import { IceconnectNexaOnboardClient } from "@/components/iceconnect/IceconnectNexaOnboardClient";
import { getAuthUserFromCookies } from "@/lib/auth";

export default async function IceconnectOnboardPage() {
  const user = await getAuthUserFromCookies();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/onboard");
  if (user.employeeSystem !== "ICECONNECT" || user.iceconnectEmployeeRole !== "BDE") {
    redirect("/iceconnect/bde");
  }
  return <IceconnectNexaOnboardClient />;
}
