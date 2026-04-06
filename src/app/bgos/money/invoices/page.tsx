import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserRole } from "@prisma/client";
import { BgosInvoiceListClient } from "@/components/bgos/BgosInvoiceListClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ quotationId?: string }>;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/money/invoices");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  const sp = await searchParams;
  const initialQuotationId =
    typeof sp.quotationId === "string" && sp.quotationId.trim() ? sp.quotationId.trim() : null;

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link href="/bgos/money" className="text-xs font-medium text-white/50 transition hover:text-[#FFC300]">
          ← Money
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Invoices</h1>
        <p className="mt-1 text-sm text-white/55">
          Track balances, record payments, and download PDFs — scoped to your active company.
        </p>
      </div>
      <Suspense
        fallback={<p className={`mx-auto max-w-5xl px-4 py-12 text-sm text-white/45 sm:px-6`}>Loading…</p>}
      >
        <BgosInvoiceListClient initialQuotationId={initialQuotationId} />
      </Suspense>
    </div>
  );
}
