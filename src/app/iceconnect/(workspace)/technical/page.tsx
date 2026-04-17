import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard } from "@/lib/role-routing";
import IceconnectTechDashboardPage from "@/app/iceconnect/(workspace)/tech/page";
import { AccessMismatchError } from "@/components/auth/AccessMismatchError";

export default async function IceconnectTechnicalPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/technical");
  if (!canAccessIceconnectDashboard("technical", user.role)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-white">
        <AccessMismatchError />
      </div>
    );
  }
  return <IceconnectTechDashboardPage />;
}
