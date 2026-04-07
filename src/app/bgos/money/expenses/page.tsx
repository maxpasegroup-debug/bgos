import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserRole } from "@prisma/client";
import { BgosExpensesPageClient } from "@/components/bgos/BgosExpensesPageClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosExpensesPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/money/expenses");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link href="/bgos" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
          ← Command center
        </Link>
      </div>
      <Suspense
        fallback={<p className={`mx-auto max-w-6xl px-4 py-12 text-sm text-white/45 sm:px-6`}>Loading…</p>}
      >
        <BgosExpensesPageClient />
      </Suspense>
    </div>
  );
}
