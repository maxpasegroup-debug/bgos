import Link from "next/link";
import { LegalDocLayout } from "@/components/legal/LegalDocLayout";

export default function EarningsDisclaimerPage() {
  return (
    <LegalDocLayout title="Earnings Disclaimer">
      <p className="text-lg font-medium text-amber-100/95">
        Performance-based compensation only. <strong>No guaranteed income.</strong>
      </p>
      <p className="mt-4">
        BGOS may display examples, targets, or illustrative amounts (including notional bonuses tied to
        points or milestones). These are <strong>not promises</strong> of future earnings. Actual results
        depend on individual effort, market conditions, compliance, and programme rules.
      </p>
      <h2>Not financial advice</h2>
      <p>
        Nothing on the platform is financial, legal, or tax advice. Consult your own advisors for your
        situation.
      </p>
      <h2>Programme changes</h2>
      <p>
        Point values, thresholds, and reward mechanics may change with notice as the product evolves.
      </p>
      <p className="mt-8">
        <Link href="/legal/bde-agreement" className="text-cyan-400 hover:underline">
          Growth Consultant agreement
        </Link>
        {" · "}
        <Link href="/legal/terms-and-conditions" className="text-cyan-400 hover:underline">
          Terms &amp; Conditions
        </Link>
      </p>
    </LegalDocLayout>
  );
}
