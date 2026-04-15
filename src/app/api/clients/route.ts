import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MIGRATE = "/api/bgos/control/clients" as const;

/**
 * @deprecated Use {@link GET /api/bgos/control/clients}.
 */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = MIGRATE;
  return NextResponse.redirect(url, 308);
}

export function HEAD(request: NextRequest) {
  return GET(request);
}

export function POST() {
  return NextResponse.json(
    {
      ok: false as const,
      code: "DEPRECATED" as const,
      error: "This endpoint is removed. Use the BGOS control API.",
      migrateTo: MIGRATE,
    },
    { status: 410 },
  );
}
