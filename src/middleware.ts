import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** External callbacks without browser cookies — must stay reachable without session. */
const WEBHOOK_PREFIXES = ["/api/payment/webhook", "/api/payment/razorpay/webhook"] as const;

function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  const PUBLIC = ["/login", "/signup", "/api/auth"];

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (isWebhookPath(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
