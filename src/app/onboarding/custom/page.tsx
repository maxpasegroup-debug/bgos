import { redirect } from "next/navigation";
import { BGOS_ONBOARDING_ENTRY } from "@/lib/system-readiness";

export default function OnboardingCustomFormPage() {
  redirect(BGOS_ONBOARDING_ENTRY);
}
