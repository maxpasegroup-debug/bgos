import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { NexaOnboardBossClient } from "@/components/onboarding/NexaOnboardBossClient";

export default async function NexaOnboardingPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/login?from=/onboarding/nexa");
  return <NexaOnboardBossClient />;
}
