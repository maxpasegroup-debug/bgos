import Link from "next/link";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { bodyMutedClass, glassPanel, headingClass } from "@/styles/design-system";

export const dynamic = "force-dynamic";

export default function InternalAnnouncementsPage() {
  return (
    <div className={`min-h-full pb-20 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mx-auto max-w-3xl">
        <h1 className={headingClass}>Announcements</h1>
        <p className={`${bodyMutedClass} mt-2`}>
          Broadcast updates to BDE, BDM, RSM, and tech — separate from client tenant messaging.
        </p>
        <div className={`${glassPanel} mt-8 p-6`}>
          <p className="text-sm text-white/80">
            Announcement composer and delivery channels will plug in here; navigation is live for the
            internal shell.
          </p>
          <Link
            href="/internal/control"
            className="mt-4 inline-block text-sm font-medium text-[#4FD1FF] hover:underline"
          >
            Back to Control →
          </Link>
        </div>
      </div>
    </div>
  );
}
