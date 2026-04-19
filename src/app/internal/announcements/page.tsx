import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

export default async function InternalAnnouncementsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/internal/login");

  const internalUser = await getInternalUserRole(user.sub);
  if (!internalUser) redirect("/internal/login");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center max-w-md">
        <p className="text-2xl mb-2">📢</p>
        <h1 className="text-xl font-bold text-white">Announcements</h1>
        <p className="mt-2 text-sm text-white/40">Team broadcasts and campaign updates coming soon.</p>
      </div>
    </div>
  );
}
