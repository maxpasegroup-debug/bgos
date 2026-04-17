import { redirect } from "next/navigation";
import { BGOS_ONBOARDING_ENTRY } from "@/lib/system-readiness";

export default async function InternalOnboardingBasicPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.leadId) q.set("leadId", sp.leadId);
  const tail = q.toString();
  redirect(tail ? `${BGOS_ONBOARDING_ENTRY}?${tail}` : BGOS_ONBOARDING_ENTRY);
}
