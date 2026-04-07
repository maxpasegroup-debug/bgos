import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BgosDocumentsClient } from "@/components/bgos/BgosDocumentsClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosDocumentsPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/documents");
  if (!user.companyId) redirect("/bgos");

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link href="/bgos" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
          ← Command center
        </Link>
      </div>
      <Suspense
        fallback={<p className="mx-auto max-w-5xl px-4 py-12 text-sm text-white/45 sm:px-6">Loading…</p>}
      >
        <div className="pt-6">
          <BgosDocumentsClient />
        </div>
      </Suspense>
    </div>
  );
}
