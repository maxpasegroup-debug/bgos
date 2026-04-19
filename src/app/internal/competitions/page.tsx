import Link from "next/link";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { bodyMutedClass, glassPanel, headingClass } from "@/styles/design-system";

export const dynamic = "force-dynamic";

export default function InternalCompetitionsPage() {
  return (
    <div className={`min-h-full pb-20 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mx-auto max-w-3xl">
        <h1 className={headingClass}>Competitions</h1>
        <p className={`${bodyMutedClass} mt-2`}>
          Create targets, track points, and publish leaderboards for the internal sales network.
        </p>
        <div className={`${glassPanel} mt-8 p-6`}>
          <p className="text-sm text-white/80">
            Full competition engine (targets, rewards, progress) is wired next — this route is reserved
            for the locked internal workspace.
          </p>
          <Link
            href="/internal/sales"
            className="mt-4 inline-block text-sm font-medium text-[#4FD1FF] hover:underline"
          >
            Go to Sales →
          </Link>
        </div>
      </div>
    </div>
  );
}
