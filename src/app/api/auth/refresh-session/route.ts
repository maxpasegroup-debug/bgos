import { NextResponse } from "next/server";

/**
 * Legacy subscription refresh used the DB-minted JWT pipeline.
 * Cookie auth sessions do not require a separate refresh; kept as a safe no-op so existing clients do not break.
 */
export async function POST() {
  return NextResponse.json({
    ok: true as const,
    refreshed: false as const,
    message: "Session refresh is not required for the current auth mode.",
  });
}
