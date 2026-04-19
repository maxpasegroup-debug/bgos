import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getInternalUserRole, INTERNAL_ROLE_LABELS } from "@/lib/internal-auth";
import { getRoleHome } from "@/lib/role-routing";
import { getAgreementStatus } from "@/lib/internal-withdrawals";
import { AUTH_HEADER_MW_PATHNAME } from "@/lib/auth-config";
import { InternalSessionProvider } from "@/components/internal/InternalSessionContext";
import { MobileWrapper } from "@/components/mobile/MobileWrapper";

/** Paths that must bypass the agreement check (the agreement page itself + legal subtree). */
function isLegalPath(pathname: string): boolean {
  return pathname === "/internal/legal" || pathname.startsWith("/internal/legal/");
}

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUserFromHeaders();

  if (!user) {
    redirect("/internal/login");
  }

  const internalUser = await getInternalUserRole(user.sub);

  if (!internalUser) {
    // Authenticated but not an internal staff member — send to their normal home
    redirect(getRoleHome(user.role));
  }

  // -------------------------------------------------------------------------
  // Agreement gate  (bgos_legal_lock_v1)
  //
  // Every internal staff member must accept the BGOS Partner Agreement before
  // they can access any dashboard page.  Legal pages are excluded from the
  // check so the agreement page itself does not trigger a redirect loop.
  // -------------------------------------------------------------------------
  const currentPath = (await headers()).get(AUTH_HEADER_MW_PATHNAME) ?? "";

  if (!isLegalPath(currentPath)) {
    const { accepted } = await getAgreementStatus(internalUser.userId);
    if (!accepted) {
      const from = encodeURIComponent(currentPath || "/internal/sales");
      redirect(`/internal/legal/bde-agreement?from=${from}`);
    }
  }

  return (
    <InternalSessionProvider
      session={{
        userId: internalUser.userId,
        email: internalUser.email,
        salesNetworkRole: internalUser.salesNetworkRole,
        roleLabel: INTERNAL_ROLE_LABELS[internalUser.salesNetworkRole],
      }}
    >
      {/* MobileWrapper selects InternalShell (desktop) or MobileLayout (≤768 px) */}
      <MobileWrapper>
        {children}
      </MobileWrapper>
    </InternalSessionProvider>
  );
}
