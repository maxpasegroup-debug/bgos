import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserRole } from "@prisma/client";
import { BgosQuotationCreateClient } from "@/components/bgos/BgosQuotationCreateClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

function CreateFallback() {
  return (
    <div className={`mx-auto max-w-4xl px-4 py-16 text-sm text-white/45 sm:px-6 ${BGOS_MAIN_PAD}`}>
      Loading builder…
    </div>
  );
}

export default async function BgosQuotationCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/money/quotation/create");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  const sp = await searchParams;
  const initialLeadId = typeof sp.leadId === "string" ? sp.leadId : null;

  return (
    <div className={`${BGOS_MAIN_PAD} pb-8 pt-8`}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Link
          href="/bgos"
          className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]"
        >
          ← Command center
        </Link>
      </div>
      <Suspense fallback={<CreateFallback />}>
        <BgosQuotationCreateClient initialLeadId={initialLeadId} />
      </Suspense>
    </div>
  );
}
