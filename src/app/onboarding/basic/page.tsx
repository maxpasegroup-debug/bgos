import { InternalClientOnboardingForm } from "@/components/onboarding/InternalClientOnboardingForm";

export default async function InternalOnboardingBasicPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const sp = await searchParams;
  return <InternalClientOnboardingForm tier="basic" leadId={sp.leadId ?? null} />;
}
