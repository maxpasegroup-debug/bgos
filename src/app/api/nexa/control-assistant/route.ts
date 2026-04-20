import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

/**
 * Lightweight Nexa chat for super boss (no tenant company required).
 */
export async function POST(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const q = parsed.data.message;
    const lower = q.toLowerCase();
    let reply =
      "Name the lane: Sales Network, People, Accounts, or Tech. I will answer in one pass.";

    if (lower.includes("sales") || lower.includes("bde") || lower.includes("rsm")) {
      reply =
        "Sales Network: confirm RSM to BDM to BDE coverage. Open Targets. Align promotions with live pipeline.";
    } else if (lower.includes("hr") || lower.includes("people") || lower.includes("team")) {
      reply =
        "People: confirm Tech Executive coverage. Review wellbeing signals. Hold training milestones visible.";
    } else if (lower.includes("account") || lower.includes("revenue") || lower.includes("commission")) {
      reply =
        "Accounts: reconcile inflows with commission payouts. Flag drift before month close.";
    } else if (lower.includes("tech") || lower.includes("queue")) {
      reply =
        "Tech: drain the round-robin queue. Scan recent completions for repeat failure modes.";
    }

    return NextResponse.json({
      ok: true as const,
      reply: `Nexa. ${reply}`,
    });
  } catch {
    return NextResponse.json({
      ok: true as const,
      degraded: true as const,
      reply:
        "Nexa fallback. Controller channel is syncing; continue with Sales, People, Accounts, and Tech checks.",
    });
  }
}
