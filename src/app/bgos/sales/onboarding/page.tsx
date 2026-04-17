import { redirect } from "next/navigation";
import { BGOS_ONBOARDING_ENTRY } from "@/lib/system-readiness";

export default function SalesOnboardingRedirectPage() {
  redirect(`${BGOS_ONBOARDING_ENTRY}?source=sales`);
}
