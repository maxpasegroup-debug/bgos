import { redirect } from "next/navigation";

type Search = { addBusiness?: string; source?: string; resume?: string };

/** Legacy `/onboarding` — unified product flow lives at `/onboarding/nexa`. */
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
  redirect(q ? `/onboarding/nexa?${q}` : "/onboarding/nexa");
}
