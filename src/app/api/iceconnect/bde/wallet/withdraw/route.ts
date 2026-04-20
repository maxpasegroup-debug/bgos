import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { requestWithdrawal } from "@/lib/bde-wallet";

const bodySchema = z.object({
  amount_inr: z.number().positive().max(10_000_000),
});

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const req = await requestWithdrawal(session.sub, parsed.data.amount_inr);
    return NextResponse.json({
      ok: true as const,
      request_id: req.id,
      status: req.status.toLowerCase(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Withdrawal failed";
    return NextResponse.json(
      { ok: false as const, error: msg, code: "WITHDRAW_FAILED" as const },
      { status: 400 },
    );
  }
}
