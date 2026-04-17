import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard } from "@/lib/role-routing";
import { AccessMismatchError } from "@/components/auth/AccessMismatchError";
import { IceconnectManagerDashboard } from "@/components/iceconnect/IceconnectManagerDashboard";

export default async function IceconnectManagerPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/manager");
  if (!canAccessIceconnectDashboard("manager", user.role)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-white">
        <AccessMismatchError />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Sales Manager Dashboard</h1>
      <p className="text-xs text-white/45">Session: {user.email}</p>
      <IceconnectManagerDashboard />
    </div>
  );
}
