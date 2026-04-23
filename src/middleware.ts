import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_HEADER_COMPANY_ID,
  AUTH_HEADER_COMPANY_PLAN,
  AUTH_HEADER_MW_PATHNAME,
  AUTH_HEADER_NEEDS_COMPANY,
  AUTH_HEADER_PREFIX,
  AUTH_HEADER_SUPER_BOSS,
  AUTH_HEADER_USER_EMAIL,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_USER_ROLE,
  AUTH_HEADER_WORKSPACE_READY,
  companyPlanFromJwtClaim,
  pathnameRequiresProPlan,
} from "@/lib/auth-config";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { SUPER_BOSS_HOME_PATH, getRoleHome, roleCanAccessPath } from "@/lib/role-routing";

const WEBHOOK_PREFIXES = ["/api/payment/webhook", "/api/payment/razorpay/webhook"] as const;
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/api/auth",
  "/onboarding",
  "/api/categories",
  "/api/users/check",
] as const;

type CookieSessionClaims = {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  companyId?: unknown;
  companyPlan?: unknown;
  workspaceReady?: unknown;
  employeeDomain?: unknown;
  superBoss?: unknown;
  jwtVersion?: unknown;
};

function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function verifyCookieJwt(token: string): Promise<CookieSessionClaims | null> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    const claims = payload as CookieSessionClaims;
    const version = claims.jwtVersion;
    if (typeof version !== "number" || version < 2) return null;
    return claims;
  } catch {
    return null;
  }
}

function passesExplicitPageRules(
  pathname: string,
  role: string,
  employeeDomain: string,
): boolean | null {
  if (pathname === "/solar-boss" || pathname.startsWith("/solar-boss/")) {
    return role === "ADMIN" && employeeDomain === "SOLAR";
  }
  if (pathname === "/iceconnect/sde" || pathname.startsWith("/iceconnect/sde/")) {
    return role === "TECH_EXECUTIVE" || role === "TECH_HEAD" || role === "ADMIN";
  }
  if (pathname === "/solar" || pathname.startsWith("/solar/")) {
    return role === "ADMIN" || role === "MANAGER";
  }
  return null;
}

function effectivePlanFromClaims(claims: CookieSessionClaims): "BASIC" | "PRO" | "ENTERPRISE" {
  if (isPlanLockedToBasic()) return "BASIC";
  return companyPlanFromJwtClaim(claims.companyPlan);
}

function forbiddenApi(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

function unauthorizedApi(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

function redirectHome(req: NextRequest, role: string, superBoss: boolean) {
  const home = superBoss ? SUPER_BOSS_HOME_PATH : getRoleHome(role);
  return NextResponse.redirect(new URL(home, req.url));
}

function appendAuthHeaders(req: NextRequest, claims: CookieSessionClaims, effectivePlan: "BASIC" | "PRO" | "ENTERPRISE") {
  const requestHeaders = new Headers(req.headers);
  for (const key of requestHeaders.keys()) {
    if (key.toLowerCase().startsWith(AUTH_HEADER_PREFIX)) {
      requestHeaders.delete(key);
    }
  }

  const sub = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : "";
  const role = typeof claims.role === "string" ? claims.role : "";
  const companyId = typeof claims.companyId === "string" ? claims.companyId : "";
  const workspaceReady = claims.workspaceReady !== false;
  const superBoss = claims.superBoss === true;

  if (sub) requestHeaders.set(AUTH_HEADER_USER_ID, sub);
  if (email) requestHeaders.set(AUTH_HEADER_USER_EMAIL, email);
  if (role) requestHeaders.set(AUTH_HEADER_USER_ROLE, role);
  requestHeaders.set(AUTH_HEADER_MW_PATHNAME, req.nextUrl.pathname);
  requestHeaders.set(AUTH_HEADER_SUPER_BOSS, superBoss ? "1" : "0");
  requestHeaders.set(AUTH_HEADER_WORKSPACE_READY, workspaceReady ? "1" : "0");

  if (companyId) {
    requestHeaders.set(AUTH_HEADER_COMPANY_ID, companyId);
    requestHeaders.set(AUTH_HEADER_COMPANY_PLAN, effectivePlan);
    requestHeaders.set(AUTH_HEADER_NEEDS_COMPANY, "0");
  } else {
    requestHeaders.set(AUTH_HEADER_NEEDS_COMPANY, "1");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".") || pathname === "/") {
    return NextResponse.next();
  }

  if (isPublicPath(pathname) || isWebhookPath(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith("/api")) {
      return unauthorizedApi();
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return (async () => {
    const claims = await verifyCookieJwt(token);
    if (!claims) {
      if (pathname.startsWith("/api")) {
        return unauthorizedApi();
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = typeof claims.role === "string" ? claims.role : "";
    const employeeDomain = typeof claims.employeeDomain === "string" ? claims.employeeDomain : "";
    const superBoss = claims.superBoss === true;
    if (!role) {
      if (pathname.startsWith("/api")) {
        return unauthorizedApi();
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const explicit = passesExplicitPageRules(pathname, role, employeeDomain);
    if (explicit === false) {
      if (pathname.startsWith("/api")) {
        return forbiddenApi();
      }
      return redirectHome(req, role, superBoss);
    }

    if (!roleCanAccessPath(role, pathname, { superBoss })) {
      if (pathname.startsWith("/api")) {
        return forbiddenApi();
      }
      return redirectHome(req, role, superBoss);
    }

    const effectivePlan = effectivePlanFromClaims(claims);
    if (pathnameRequiresProPlan(pathname)) {
      const hasPro = effectivePlan === "PRO" || effectivePlan === "ENTERPRISE";
      if (!hasPro) {
        if (pathname.startsWith("/api")) {
          return forbiddenApi("Upgrade required");
        }
        return NextResponse.redirect(new URL("/bgos/subscription", req.url));
      }
    }

    return appendAuthHeaders(req, claims, effectivePlan);
  })();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
