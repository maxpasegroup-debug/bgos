import { NexaOnboardBossClient } from "@/components/onboarding/NexaOnboardBossClient";

type Search = {
  source?: string;
  resume?: string;
  addBusiness?: string;
  leadId?: string;
  ownerId?: string;
  franchiseId?: string;
  referral?: string;
};

export default async function NexaOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Search> | Search;
}) {
  const sp = await Promise.resolve(searchParams);
  return (
    <NexaOnboardBossClient
      entrySource={typeof sp.source === "string" ? sp.source : undefined}
      resume={sp.resume === "1" || sp.resume === "true"}
      addBusiness={sp.addBusiness === "1"}
      urlLeadId={typeof sp.leadId === "string" ? sp.leadId : undefined}
      urlSalesOwnerId={typeof sp.ownerId === "string" ? sp.ownerId : undefined}
      urlFranchiseId={typeof sp.franchiseId === "string" ? sp.franchiseId : undefined}
      urlReferralSource={typeof sp.referral === "string" ? sp.referral : undefined}
    />
  );
}
