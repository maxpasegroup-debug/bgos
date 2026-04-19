import Link from "next/link";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { bodyMutedClass, glassPanel, headingClass } from "@/styles/design-system";

export const dynamic = "force-dynamic";

export default function InternalOnboardCompanyPage() {
  return (
    <div className={`min-h-full pb-20 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mx-auto max-w-3xl">
        <h1 className={headingClass}>Onboard company</h1>
        <p className={`${bodyMutedClass} mt-2`}>
          Search by email, confirm an existing account, or start a new tenant — attribution stays with
          the sourcing BDE.
        </p>
        <div className={`${glassPanel} mt-8 space-y-4 p-6`}>
          <p className="text-sm text-white/80">
            The full guided flow (industry, plan, activation, and{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">source_user_id</code>) lands
            here next to match the internal sales spec.
          </p>
          <p className="text-sm text-white/60">
            Until then, use the existing company creation and Nexa onboarding tools from the platform
            workspace.
          </p>
          <Link
            href="/internal/sales"
            className="inline-block text-sm font-medium text-[#4FD1FF] hover:underline"
          >
            Open Sales workspace →
          </Link>
        </div>
      </div>
    </div>
  );
}
