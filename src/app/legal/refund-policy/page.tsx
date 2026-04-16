import { LegalDocLayout } from "@/components/legal/LegalDocLayout";

export default function RefundPolicyPage() {
  return (
    <LegalDocLayout title="Refund Policy">
      <p>
        This Refund Policy explains how subscription and related payments are handled for BGOS.online operated by MIB-
        make it beautiful LLP.
      </p>
      <h2>Subscription payments</h2>
      <p>
        Paid subscriptions (for example Basic, Pro, or Enterprise tiers) are billed according to the plan you select at
        checkout. Where applicable, renewals are charged on the billing cycle shown in your account or invoice.
      </p>
      <h2>Trial and onboarding</h2>
      <p>
        Trial availability, duration, and feature limits may vary by plan and deployment configuration. Completing
        onboarding or activating a workspace does not automatically guarantee eligibility for a refund if a paid
        period has begun under the terms presented at purchase.
      </p>
      <h2>Refund eligibility</h2>
      <p>
        If you believe you are entitled to a refund, contact us with your account email, company name (if applicable),
        invoice or payment reference, and a clear description of the issue. Eligibility is assessed case-by-case in line
        with applicable consumer regulations and the terms agreed at purchase.
      </p>
      <h2>Non-refundable cases (common examples)</h2>
      <ul>
        <li>Fees for services already delivered or consumed (for example, after substantial usage of paid features).</li>
        <li>Charges where a third-party payment processor policy prevents reversal.</li>
        <li>Accounts terminated for misuse, fraud, or violation of the Terms &amp; Conditions.</li>
      </ul>
      <h2>Discretionary review</h2>
      <p>
        We may offer credits, partial refunds, or plan adjustments where fair and commercially reasonable, but such
        remedies are not guaranteed.
      </p>
      <h2>Contact</h2>
      <p>
        Refund requests:{" "}
        <a href="mailto:hello@bgos.online" className="text-amber-300 hover:underline">
          hello@bgos.online
        </a>
      </p>
    </LegalDocLayout>
  );
}
