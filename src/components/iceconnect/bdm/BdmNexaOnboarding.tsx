"use client";

import { NexaOnboardBossClient } from "@/components/onboarding/NexaOnboardBossClient";
import type { AuthUser } from "@/lib/auth";

type LeadSeed = {
  id: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  industry?: string | null;
};

export function BdmNexaOnboarding({
  lead,
  user,
  onClose,
}: {
  lead: LeadSeed;
  user: AuthUser;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
          >
            Close
          </button>
        </div>
        <NexaOnboardBossClient
          entrySource="franchise"
          urlLeadId={lead.id}
          urlFranchiseId={user.sub}
          urlReferralSource="FRANCHISE_PARTNER"
          prefillName={lead.contactName ?? ""}
          prefillEmail={lead.email ?? ""}
          prefillCompanyName={lead.companyName}
          prefillCategory={lead.industry ?? ""}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
