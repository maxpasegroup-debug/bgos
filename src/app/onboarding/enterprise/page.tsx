import { InternalClientOnboardingForm } from "@/components/onboarding/InternalClientOnboardingForm";

export default async function InternalOnboardingEnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const sp = await searchParams;
  return <InternalClientOnboardingForm tier="enterprise" leadId={sp.leadId ?? null} />;
}
