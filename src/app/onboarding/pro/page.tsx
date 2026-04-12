import { InternalClientOnboardingForm } from "@/components/onboarding/InternalClientOnboardingForm";

export default async function InternalOnboardingProPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const sp = await searchParams;
  return <InternalClientOnboardingForm tier="pro" leadId={sp.leadId ?? null} />;
}
