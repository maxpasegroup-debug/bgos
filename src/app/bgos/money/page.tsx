import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserRole } from "@prisma/client";
import { BgosMoneyPageClient } from "@/components/bgos/BgosMoneyPageClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; leadId?: string; quotationId?: string }>;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/money");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  const sp = await searchParams;
  if (sp.tab === "invoices") {
    const q = new URLSearchParams();
    if (typeof sp.quotationId === "string" && sp.quotationId.trim()) {
      q.set("quotationId", sp.quotationId.trim());
    }
    redirect(`/bgos/money/invoices${q.size ? `?${q}` : ""}`);
  }
  const initialTab = typeof sp.tab === "string" ? sp.tab : null;
  const initialLeadId = typeof sp.leadId === "string" ? sp.leadId : null;
  const initialQuotationId = typeof sp.quotationId === "string" ? sp.quotationId : null;

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          href="/bgos"
          className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]"
        >
          ← Command center
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Money</h1>
        <p className="mt-1 text-sm text-white/55">
          Quotations, invoices, payments, and expenses — scoped to your active company.
        </p>
      </div>
      <Suspense
        fallback={<p className={`mx-auto max-w-5xl px-4 py-12 text-sm text-white/45 sm:px-6`}>Loading…</p>}
      >
        <BgosMoneyPageClient
          initialTab={initialTab}
          initialLeadId={initialLeadId}
          initialQuotationId={initialQuotationId}
        />
      </Suspense>
    </div>
  );
}
