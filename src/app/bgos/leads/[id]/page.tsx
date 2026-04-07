import { redirect } from "next/navigation";
import { BgosLeadDetailClient } from "@/components/bgos/BgosLeadDetailClient";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { getAuthUserFromHeaders } from "@/lib/auth";

export default async function BgosLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/bgos");

  const { id } = await params;
  if (!id?.trim()) redirect("/bgos");

  return (
    <div className={`${BGOS_MAIN_PAD} pb-16 pt-8`}>
      <BgosLeadDetailClient leadId={id.trim()} />
    </div>
  );
}
