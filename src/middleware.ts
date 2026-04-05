import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
import { getRoleHome, roleCanAccessPath } from "@/lib/role-routing";

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
  return true;
}

async function verifyJwtEdge(token: string): Promise<Record<string, unknown> | null> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: AUTH_JWT_ISSUER,
      algorithms: ["HS256"],
    });
    return payload as Record<string, unknown>;
  } catch {
    return null;
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

function isPublicApiPath(pathname: string): boolean {
  return pathname === "/api/auth/login" || pathname.startsWith("/api/auth/login/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") && isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  const isProtected =
    pathname.startsWith("/bgos") ||
    pathname.startsWith("/iceconnect") ||
    (pathname.startsWith("/api") && !isPublicApiPath(pathname));

  if (!isProtected) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  stripInternalAuthHeaders(requestHeaders);

  const token = readToken(request);
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  const payload = await verifyJwtEdge(token);
  if (!payload || !tryAttachUserHeaders(requestHeaders, payload)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  const role = String(payload.role);

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

  const companyPlan = requestHeaders.get(AUTH_HEADER_COMPANY_PLAN) ?? "BASIC";
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
  matcher: ["/bgos/:path*", "/iceconnect", "/iceconnect/:path*", "/api/:path*"],
};
