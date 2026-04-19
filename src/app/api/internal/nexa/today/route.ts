/**
 * GET /api/internal/nexa/today
 *
 * Returns proactive Nexa messages for the authenticated internal staff member.
 * Side-effect: updates lastLoginAt and resets daily task counter if needed.
 *
 * Response shape is intentionally opaque — no commission splits, no raw scores.
 */

import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { prisma } from "@/lib/prisma";
import {
  trackInternalLogin,
  getInternalBehaviorContext,
  buildInternalNexaMessages,
} from "@/lib/internal-nexa-behavior";

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const { userId, companyId } = session;

    // Track login (side-effect: updates lastLoginAt, resets daily counter if new day)
    await trackInternalLogin(prisma, userId, companyId);

    const ctx = await getInternalBehaviorContext(prisma, userId, companyId);
    if (!ctx) {
      return NextResponse.json(
        { ok: false as const, error: "Context not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }

    const result = buildInternalNexaMessages(ctx);

    return NextResponse.json({
      ok: true as const,
      messages: result.messages,
      extraTasks: result.extraTasks,
      urgencyLevel: result.urgencyLevel,
      inactivityDays: Math.round(result.inactivityDays * 10) / 10,
    });
  } catch (e) {
    logCaughtError("internal-nexa-today", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to build Nexa plan", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
