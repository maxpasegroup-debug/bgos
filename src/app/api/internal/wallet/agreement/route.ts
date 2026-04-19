import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { acceptAgreement, getAgreementStatus } from "@/lib/internal-withdrawals";

/**
 * GET  /api/internal/wallet/agreement
 * Returns whether the current user has accepted the BDE agreement.
 */
export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const status = await getAgreementStatus(session.userId);
  return NextResponse.json({ ok: true as const, ...status });
}

/**
 * POST /api/internal/wallet/agreement
 * Records acceptance of the BDE agreement for the current user.
 * Body: { accepted: true }  (explicit consent field required)
 */
export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  let body: { accepted?: unknown } = {};
  try {
    body = (await request.json()) as { accepted?: unknown };
  } catch {
    // empty body — fall through to validation error
  }

  if (body.accepted !== true) {
    return NextResponse.json(
      { ok: false as const, error: 'Send { "accepted": true } to confirm agreement acceptance.' },
      { status: 400 },
    );
  }

  await acceptAgreement(session.userId);
  return NextResponse.json({ ok: true as const, accepted: true });
}
