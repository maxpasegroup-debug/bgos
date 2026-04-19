import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getInternalUserRole, getInternalRoleHome, INTERNAL_ROLE_LABELS } from "@/lib/internal-auth";

/**
 * GET /api/internal/session
 *
 * Returns the caller's internal role and is_internal flag.
 * Used by /internal/login after successful authentication to determine
 * the correct redirect destination.
 */
export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const internalUser = await getInternalUserRole(user.sub);

  if (!internalUser) {
    return NextResponse.json({
      ok: true as const,
      isInternal: false as const,
      salesNetworkRole: null,
      roleLabel: null,
      nextPath: null,
    });
  }

  return NextResponse.json({
    ok: true as const,
    isInternal: true as const,
    salesNetworkRole: internalUser.salesNetworkRole,
    roleLabel: INTERNAL_ROLE_LABELS[internalUser.salesNetworkRole],
    nextPath: getInternalRoleHome(internalUser.salesNetworkRole),
  });
}
