import { jwtVerify, errors } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_ERROR_CODES, authErrorResponse } from "@/lib/auth-api";
import {
  AUTH_COOKIE_NAME,
  AUTH_HEADER_COMPANY_ID,
  AUTH_HEADER_COMPANY_PLAN,
  AUTH_HEADER_USER_EMAIL,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_USER_ROLE,
  AUTH_HEADER_PREFIX,
  AUTH_JWT_ISSUER,
  companyPlanFromJwtClaim,
  pathnameRequiresProPlan,
} from "@/lib/auth-config";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { hostTenantFromHeader } from "@/lib/host-routing";
import { getRoleHome, roleCanAccessPath } from "@/lib/role-routing";

function bgosAllowsPagePath(pathname: string): boolean {
  if (pathname === "/bgos" || pathname.startsWith("/bgos/")) return true;
  if (pathname === "/login" || pathname === "/signup") return true;
  return false;
}

function iceAllowsPagePath(pathname: string): boolean {
  return pathname === "/iceconnect" || pathname.startsWith("/iceconnect/");
}

function iceAllowsApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/iceconnect") ||
    pathname.startsWith("/api/tasks/complete")
  );
}

function wrongHostJson(message: string): NextResponse {
  return NextResponse.json(
    { ok: false as const, error: message, code: "WRONG_HOST" },
    { status: 403 },
  );
}

function stripInternalAuthHeaders(headers: Headers): void {
  const toRemove: string[] = [];
  headers.forEach((_, key) => {
    if (key.toLowerCase().startsWith(AUTH_HEADER_PREFIX.toLowerCase())) {
      toRemove.push(key);
    }
  });
  for (const k of toRemove) headers.delete(k);
}

function tryAttachUserHeaders(
  headers: Headers,
  payload: Record<string, unknown>,
): boolean {
  const sub = payload.sub;
  const email = payload.email;
  const role = payload.role;
  const companyId = payload.companyId;
  if (typeof sub !== "string" || !sub) return false;
  if (typeof email !== "string" || !email) return false;
  if (typeof role !== "string" || !role) return false;
  if (typeof companyId !== "string" || !companyId) return false;
  headers.set(AUTH_HEADER_USER_ID, sub);
  headers.set(AUTH_HEADER_USER_EMAIL, email);
  headers.set(AUTH_HEADER_USER_ROLE, role);
  headers.set(AUTH_HEADER_COMPANY_ID, companyId);
  headers.set(AUTH_HEADER_COMPANY_PLAN, companyPlanFromJwtClaim(payload.companyPlan));
  if (isPlanLockedToBasic()) {
    headers.set(AUTH_HEADER_COMPANY_PLAN, "BASIC");
  }
  return true;
}

type EdgeVerifyResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: "expired" | "invalid" };

async function verifyJwtEdge(token: string): Promise<EdgeVerifyResult> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return { ok: false, reason: "invalid" };
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: AUTH_JWT_ISSUER,
      algorithms: ["HS256"],
    });
    return { ok: true, payload: payload as Record<string, unknown> };
  } catch (e) {
    if (e instanceof errors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
}

function readToken(request: NextRequest): string | null {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookie) return cookie;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    return t || null;
  }
  return null;
}

/** Paths that skip auth (marketing, sign-in, session helpers). */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/iceconnect/login") return true;
  if (pathname === "/api/auth/login") return true;
  if (pathname === "/api/auth/signup") return true;
  if (pathname === "/api/auth/logout") return true;
  if (pathname === "/api/auth/me") return true;
  if (pathname === "/signup") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const tenant = hostTenantFromHeader(host);

  if (tenant === "bgos") {
    if (pathname.startsWith("/api")) {
      if (pathname.startsWith("/api/iceconnect")) {
        return wrongHostJson("ICECONNECT API is only available on iceconnect.in");
      }
    } else if (!bgosAllowsPagePath(pathname)) {
      return NextResponse.redirect(new URL("/bgos", request.url));
    }
  }

  if (tenant === "ice") {
    if (pathname.startsWith("/api")) {
      if (!iceAllowsApiPath(pathname)) {
        return wrongHostJson("This API is only available on bgos.online");
      }
    } else if (!iceAllowsPagePath(pathname)) {
      if (pathname === "/login" || pathname === "/signup") {
        const url = new URL("/iceconnect/login", request.url);
        const from = request.nextUrl.searchParams.get("from");
        if (from) url.searchParams.set("from", from);
        return NextResponse.redirect(url);
      }
      return NextResponse.redirect(new URL("/iceconnect/login", request.url));
    }
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/iceconnect/login") {
      const iceToken = readToken(request);
      if (!iceToken) return NextResponse.next();
      const iceVerified = await verifyJwtEdge(iceToken);
      if (
        iceVerified.ok &&
        typeof iceVerified.payload.role === "string"
      ) {
        return NextResponse.redirect(
          new URL(getRoleHome(String(iceVerified.payload.role)), request.url),
        );
      }
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  stripInternalAuthHeaders(requestHeaders);

  const token = readToken(request);

  if (!token) {
    if (pathname.startsWith("/api")) {
      return authErrorResponse(AUTH_ERROR_CODES.NO_TOKEN);
    }
    const login =
      pathname.startsWith("/iceconnect") && pathname !== "/iceconnect/login"
        ? new URL("/iceconnect/login", request.url)
        : new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  const verified = await verifyJwtEdge(token);

  if (!verified.ok) {
    if (pathname.startsWith("/api")) {
      return authErrorResponse(
        verified.reason === "expired"
          ? AUTH_ERROR_CODES.TOKEN_EXPIRED
          : AUTH_ERROR_CODES.TOKEN_INVALID,
      );
    }
    const login =
      pathname.startsWith("/iceconnect") && pathname !== "/iceconnect/login"
        ? new URL("/iceconnect/login", request.url)
        : new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  if (!tryAttachUserHeaders(requestHeaders, verified.payload)) {
    if (pathname.startsWith("/api")) {
      return authErrorResponse(AUTH_ERROR_CODES.TOKEN_INVALID);
    }
    const login =
      pathname.startsWith("/iceconnect") && pathname !== "/iceconnect/login"
        ? new URL("/iceconnect/login", request.url)
        : new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  const role = String(verified.payload.role);

  if (pathname === "/iceconnect" || pathname === "/iceconnect/") {
    const home = getRoleHome(role);
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (!roleCanAccessPath(role, pathname)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL(getRoleHome(role), request.url));
  }

  // Company.plan (BASIC | PRO): block Pro-only APIs for Basic JWTs — see `pathnameRequiresProPlan`
  // in auth-config (automation + sales-booster, except upgrade-request allowlist).
  const companyPlanRaw = requestHeaders.get(AUTH_HEADER_COMPANY_PLAN) ?? "BASIC";
  const companyPlan = isPlanLockedToBasic() ? "BASIC" : companyPlanRaw;
  if (
    pathname.startsWith("/api") &&
    pathnameRequiresProPlan(pathname) &&
    companyPlan !== "PRO"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "This feature requires a Pro plan",
        code: "PLAN_PRO_REQUIRED",
      },
      { status: 403 },
    );
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * All non-static routes: enforce auth except public paths handled in middleware.
     * Excludes Next assets and common image extensions.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
