import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { BgosCompanySettingsForm } from "@/components/bgos/BgosCompanySettingsForm";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

export default async function BgosCompanySettingsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/settings");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/bgos"
            className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]"
          >
            ← Command center
          </Link>
          <Link
            href="/bgos/user-manuals"
            className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]"
          >
            User manuals →
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Company settings</h1>
        <p className="mt-1 text-sm text-white/55">
          Business profile used for ICECONNECT branding and future quotations, invoices, and PDFs.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-8">
          <BgosCompanySettingsForm />
        </div>
      </div>
    </div>
  );
}
