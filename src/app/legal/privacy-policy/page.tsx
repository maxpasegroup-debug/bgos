import { LegalDocLayout } from "@/components/legal/LegalDocLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocLayout title="Privacy Policy">
      <p>
        This Privacy Policy describes how MIB- make it beautiful LLP (“we”, “us”) collects, uses, and protects
        information when you use BGOS.online (“BGOS”, “the platform”) — including boss dashboards, employee
        dashboards, onboarding flows, and payment-related features.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account and profile data: name, email, phone, role, company memberships, and authentication events.</li>
        <li>Business operational data you enter: leads, tasks, installations, invoices, HR records, inventory, and similar workspace content.</li>
        <li>Onboarding data: company structure, team roles, documents uploaded during onboarding, and Nexa-guided onboarding session metadata.</li>
        <li>Payment data: billing identifiers, subscription status, and transaction references processed by our payment partners (we do not store full card numbers on BGOS servers).</li>
        <li>Technical data: IP address, device/browser type, cookies or similar tokens used to keep you signed in securely.</li>
      </ul>
      <h2>How we use data</h2>
      <p>
        We use data to provide and improve the service, authenticate users, enforce access controls, operate internal
        sales and micro franchise programs, generate operational dashboards, send essential service communications, and
        comply with law. We do not sell personal data.
      </p>
      <h2>Account and login details</h2>
      <p>
        Passwords are stored using strong one-way hashing. Sessions may use secure cookies. Boss and employee accounts
        inherit permissions from company configuration; administrators are responsible for provisioning access
        appropriately.
      </p>
      <h2>Cookies and sessions</h2>
      <p>
        BGOS uses cookies (or equivalent mechanisms) to maintain authenticated sessions, remember active company context
        where applicable, and protect against common abuse patterns.
      </p>
      <h2>Third-party tools</h2>
      <p>
        We may use subprocessors for hosting, email delivery, analytics, and payment processing. Those providers process
        data under agreements consistent with this policy and only as needed to deliver their services to us.
      </p>
      <h2>Security</h2>
      <p>
        We implement administrative, technical, and organizational measures designed to protect data. No method of
        transmission or storage is 100% secure; please use strong passwords and protect your devices.
      </p>
      <h2>Data retention</h2>
      <p>
        We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and
        enforce agreements. Retention periods may vary by data category and legal requirements.
      </p>
      <h2>Contact</h2>
      <p>
        For privacy questions or requests, contact{" "}
        <a href="mailto:hello@bgos.online" className="text-amber-300 hover:underline">
          hello@bgos.online
        </a>
        .
      </p>
    </LegalDocLayout>
  );
}
