import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { canAccessIceconnectDashboard, getRoleHome } from "@/lib/role-routing";

export default async function IceconnectManagerPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect/manager");
  if (!canAccessIceconnectDashboard("manager", user.role)) {
    redirect(getRoleHome(user.role));
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Manager workspace</h1>
      <p className="text-sm text-white/70">
        Company operations overview. Sales and technical tools stay on their own dashboards for each role.
      </p>
      <p className="text-xs text-white/45">
        Session: {user.email} · {user.role}
      </p>
    </div>
  );
}
