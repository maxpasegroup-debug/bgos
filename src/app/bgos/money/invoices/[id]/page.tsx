import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { BgosInvoiceDetailClient } from "@/components/bgos/BgosInvoiceDetailClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos/money/invoices");
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    redirect("/bgos");
  }

  const { id } = await params;
  if (!id?.trim()) redirect("/bgos/money/invoices");

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <BgosInvoiceDetailClient invoiceId={id.trim()} />
    </div>
  );
}
