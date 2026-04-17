import { redirect } from "next/navigation";
import { BGOS_ONBOARDING_ENTRY } from "@/lib/system-readiness";

type Search = { addBusiness?: string; source?: string; resume?: string };

/** Legacy `/onboarding` — unified product flow lives at Nexa. */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Search> | Search;
}) {
  const sp = await Promise.resolve(searchParams);
  const qs = new URLSearchParams();
  if (sp.addBusiness != null) qs.set("addBusiness", String(sp.addBusiness));
  if (sp.source != null) qs.set("source", String(sp.source));
  if (sp.resume != null) qs.set("resume", String(sp.resume));
  const q = qs.toString();
  redirect(q ? `${BGOS_ONBOARDING_ENTRY}?${q}` : BGOS_ONBOARDING_ENTRY);
}
