import { LegalDocLayout } from "@/components/legal/LegalDocLayout";

export default function TermsAndConditionsPage() {
  return (
    <LegalDocLayout title="Terms & Conditions">
      <p>
        These Terms &amp; Conditions (“Terms”) govern access to and use of BGOS.online (“BGOS”) provided by MIB- make it
        beautiful LLP. By using BGOS, you agree to these Terms.
      </p>
      <h2>Platform usage</h2>
      <p>
        BGOS provides business operating software including dashboards for sales, operations, accounts, HR, inventory,
        and related modules. Features available to you depend on your plan, role, and company configuration.
      </p>
      <h2>User responsibilities</h2>
      <p>
        You agree to provide accurate information, keep credentials confidential, and not attempt to access data or
        systems you are not authorized to use. You must comply with applicable laws and respect third-party rights.
      </p>
      <h2>Boss and employee accounts</h2>
      <p>
        Company administrators (“boss” accounts) are responsible for provisioning employee access, maintaining accurate
        roster data, and ensuring internal policies are followed. Employees must use BGOS only for legitimate business
        purposes authorized by their organization.
      </p>
      <h2>Subscriptions</h2>
      <p>
        Subscription fees, renewals, trials, upgrades, and payment methods are described at purchase and in billing
        screens. Failure to pay may result in restricted access until resolved.
      </p>
      <h2>Micro franchise</h2>
      <p>
        Micro franchise partners participate under program rules configured on the platform, including referral tracking,
        commissions, wallet balances, and compliance checks. We may modify program mechanics with reasonable notice
        where required.
      </p>
      <h2>Account misuse</h2>
      <p>
        We may suspend or terminate accounts involved in fraud, scraping, security attacks, harassment, illegal activity,
        or material breach of these Terms.
      </p>
      <h2>Intellectual property</h2>
      <p>
        BGOS, its branding, software, documentation, and content are protected by intellectual property laws. You receive
        a limited, non-exclusive license to use BGOS as permitted by your subscription and role.
      </p>
      <h2>Service interruptions</h2>
      <p>
        We strive for reliability but do not guarantee uninterrupted service. Maintenance, incidents, integrations, or
        third-party outages may affect availability.
      </p>
      <h2>Changes to terms</h2>
      <p>
        We may update these Terms from time to time. Continued use after changes become effective constitutes acceptance
        of the revised Terms, except where prohibited by law.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:hello@bgos.online" className="text-amber-300 hover:underline">
          hello@bgos.online
        </a>
      </p>
    </LegalDocLayout>
  );
}
