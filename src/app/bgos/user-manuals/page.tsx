import Link from "next/link";
import { redirect } from "next/navigation";
import { UserManualCategory, UserRole } from "@prisma/client";
import { UserManualsAdminClient } from "@/components/bgos/UserManualsAdminClient";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

const CATEGORY_LABELS: { id: UserManualCategory; label: string }[] = [
  { id: UserManualCategory.SALES, label: "Sales" },
  { id: UserManualCategory.OPERATIONS, label: "Operations" },
  { id: UserManualCategory.HR, label: "HR" },
  { id: UserManualCategory.ACCOUNTS, label: "Accounts" },
  { id: UserManualCategory.SALES_BOOSTER, label: "Sales Booster" },
];

export default async function UserManualsAdminPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/user-manuals");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <div className="mx-auto max-w-xl">
        <Link href="/bgos/settings" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
          ← Settings
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">User manuals</h1>
        <p className="mt-1 text-sm text-white/55">
          One PDF (or image) per category. Uploading replaces the previous file for that category.
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <UserManualsAdminClient categories={CATEGORY_LABELS} />
        </div>
      </div>
    </div>
  );
}
