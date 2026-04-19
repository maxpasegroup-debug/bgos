import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { parseJsonBodyZod } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { handleSale } from "@/lib/internal-sales-engine";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { SalesNetworkRole } from "@prisma/client";

const bodySchema = z.object({
  /**
   * userId of the BDE making the sale.
   * Defaults to the caller — BOSS may submit on behalf of any member.
   */
  soldByUserId: z.string().trim().min(1).optional(),
  planType: z.enum(["BASIC", "PRO", "ENTERPRISE"]),
  /** Dynamic points override for ENTERPRISE (3–5). Ignored for BASIC/PRO. */
  enterprisePoints: z.number().int().min(3).max(5).optional(),
  /**
   * Optional client identifiers — passed to the fraud guard for duplicate detection.
   * Providing these enables the system to block double-earning on the same client.
   */
  clientEmail: z.string().email().trim().optional().nullable(),
  clientPhone: z.string().trim().min(5).max(20).optional().nullable(),
});

/**
 * POST /api/internal/sales/record-sale
 *
 * Records a subscription sale in the internal sales hierarchy engine.
 * Caller must be an internal staff member (salesNetworkRole set).
 *
 * BDE  → can only record a sale for themselves.
 * BOSS → may record on behalf of any member (via soldByUserId).
 */
export async function POST(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const targetUserId =
    parsed.data.soldByUserId?.trim() ?? session.userId;

  // Non-boss members may only record for themselves
  if (
    session.salesNetworkRole !== SalesNetworkRole.BOSS &&
    targetUserId !== session.userId
  ) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "You can only record a sale for your own account.",
        code: "FORBIDDEN" as const,
      },
      { status: 403 },
    );
  }

  try {
    const result = await handleSale({
      companyId:                session.companyId,
      soldByUserId:             targetUserId,
      planType:                 parsed.data.planType,
      enterprisePointsOverride: parsed.data.enterprisePoints,
      clientEmail:              parsed.data.clientEmail ?? null,
      clientPhone:              parsed.data.clientPhone ?? null,
    });

    if (result.fraudFlagged) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "This sale has been flagged as a duplicate. Earnings have been withheld pending BOSS review.",
          code: "FRAUD_FLAGGED" as const,
          subscriptionId: result.subscriptionId,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: true as const,
        subscriptionId: result.subscriptionId,
        points:         result.points,
        directAmount:   result.directAmount,
        milestoneBonus: result.milestoneBonus,
        promoted:       result.promoted,
        // recurringUnlocked is intentionally omitted from the response
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "SELLER_NOT_IN_COMPANY") {
      return NextResponse.json(
        { ok: false as const, error: "Seller is not a member of the internal org.", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    return handleApiError("POST /api/internal/sales/record-sale", e);
  }
}
