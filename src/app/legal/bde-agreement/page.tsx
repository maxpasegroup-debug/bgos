import Link from "next/link";
import { LegalDocLayout } from "@/components/legal/LegalDocLayout";

export default function BdeAgreementPage() {
  return (
    <LegalDocLayout title="BGOS Growth Consultant Agreement">
      <p className="font-medium text-slate-200">
        This agreement applies to <strong>internal platform sales roles</strong> (e.g. BDE) who promote and
        sell BGOS subscriptions — not employees of client companies using BGOS to run their business.
      </p>
      <h2>Independent role</h2>
      <p>
        You act as an independent growth consultant / independent contractor. Nothing in this agreement
        creates an employment relationship with MIB — make it beautiful LLP (“BGOS”, “we”) or with client
        companies you help onboard.
      </p>
      <h2>Performance-based compensation</h2>
      <p>
        Earnings, bonuses, and incentives are <strong>performance-based</strong>. There is{" "}
        <strong>no guaranteed income</strong>, salary, or fixed pay unless expressly documented in a
        separate signed agreement for a specific campaign.
      </p>
      <h2>No salary guarantee</h2>
      <p>
        BGOS does not promise a minimum wage or recurring salary. Compensation may depend on verified
        sales, subscription activity, and programme rules in effect at the time.
      </p>
      <h2>Compliance</h2>
      <p>
        You agree to represent BGOS fairly, follow applicable laws, and not mislead prospects about
        product capabilities or earnings.
      </p>
      <p className="mt-8">
        <Link href="/legal/earnings-disclaimer" className="text-cyan-400 hover:underline">
          Earnings disclaimer
        </Link>
        {" · "}
        <Link href="/legal/terms-and-conditions" className="text-cyan-400 hover:underline">
          Terms &amp; Conditions
        </Link>
      </p>
    </LegalDocLayout>
  );
}
