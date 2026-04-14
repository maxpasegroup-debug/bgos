import { jwtVerify, errors } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_ERROR_CODES, authErrorResponse } from "@/lib/auth-api";
import { resolveTenantFromJwt } from "@/lib/auth-active-company";
import {
  ACTIVE_COMPANY_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  AUTH_HEADER_COMPANY_ID,
  AUTH_HEADER_COMPANY_PLAN,
  AUTH_HEADER_NEEDS_COMPANY,
  AUTH_HEADER_WORKSPACE_READY,
  AUTH_HEADER_USER_EMAIL,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_USER_ROLE,
  AUTH_HEADER_PREFIX,
  AUTH_HEADER_SUPER_BOSS,
  AUTH_JWT_ISSUER,
  pathnameRequiresProPlan,
} from "@/lib/auth-config";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import {
  absoluteRoleHomeUrl,
  hostTenantFromHeader,
  publicBgosOrigin,
  type HostTenant,
} from "@/lib/host-routing";
import { getRoleHome, roleCanAccessPath } from "@/lib/role-routing";
import {
  customPaymentPendingAllowsApiRequest,
  jwtSaysCustomPaymentPending,
  jwtSaysSubscriptionExpired,
  trialExpiredAllowsApiRequest,
  TRIAL_EXPIRED_API_MESSAGE,
} from "@/lib/trial-middleware";
import { jwtCompanyPlanFromUnknown, jwtPlanIsProPlus } from "@/lib/plan-tier";
import { isBgosProductionBossBypassEmail } from "@/lib/bgos-production-boss-bypass";
import { isSuperBossEmail } from "@/lib/super-boss";

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

/**
 * Page routes that skip JWT enforcement here (no redirect to `/login` from middleware).
 * `/` is excluded from this list on purpose — it is handled in `app/page.tsx`.
 */
const PUBLIC_ROUTES = ["/login", "/signup", "/iceconnect/customer-login"] as const;

/** Boss activation wizard + public client onboarding fill — not `/onboarding/manage` (auth required). */
function isOnboardingPublicPath(p: string): boolean {
  if (p === "/onboarding") return true;
  if (p === "/onboarding/basic" || p === "/onboarding/pro" || p === "/onboarding/enterprise") return true;
  if (p.startsWith("/onboarding/fill/")) return true;
  return false;
}

function isPublicRoute(pathname: string): boolean {
  const p = normalizePathname(pathname);
  if (isOnboardingPublicPath(p)) return true;
  for (const route of PUBLIC_ROUTES) {
    if (p === route || p.startsWith(`${route}/`)) return true;
  }
  return false;
}

function isRootPath(pathname: string): boolean {
  return normalizePathname(pathname) === "/";
}

/**
 * Skip session/JWT gate: marketing root, public pages, session APIs, ICECONNECT login.
 */
function skipsMiddlewareAuth(pathname: string, method: string): boolean {
  if (isRootPath(pathname)) return true;
  if (normalizePathname(pathname) === "/lead") return true;
  if (pathname === "/api/internal-sales/public/lead" && method === "POST") return true;
  if (pathname === "/api/internal-sales/cron/automation" && method === "POST") return true;
  if (pathname.startsWith("/api/onboarding/workflow/public/")) return true;
  if (isPublicRoute(pathname)) return true;
  if (pathname === "/iceconnect/login") return true;
  if (pathname === "/iceconnect/customer-login" || pathname === "/iceconnect/customer") return true;
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/signup" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me"
  ) {
    return true;
  }
  if (pathname.startsWith("/api/customer/")) return true;
  if (pathname === "/api/auth/refresh-session" && method === "POST") return true;
  if (pathname === "/api/payment/webhook" && method === "POST") return true;
  if (pathname === "/api/payment/razorpay/webhook" && method === "POST") return true;
  return false;
}

/** Domain-based login: bgos.online → `/login`, iceconnect.in → `/iceconnect/login`, dev → `/login`. */
function loginRedirectUrl(request: NextRequest, pathname: string, tenant: HostTenant): URL {
  const loginPath = tenant === "ice" ? "/iceconnect/login" : "/login";
  const login = new URL(loginPath, request.url);
  const p = normalizePathname(pathname);
  if (
    !isRootPath(pathname) &&
    p !== "/login" &&
    p !== "/signup" &&
    p !== "/iceconnect/login"
  ) {
    login.searchParams.set("from", pathname);
  }
  return login;
}

function bgosAllowsPagePath(pathname: string): boolean {
  /** `/` is handled in `app/page.tsx` (logged in → `/bgos`, else → `/login`). */
  if (pathname === "/") return true;
  if (normalizePathname(pathname) === "/lead") return true;
  if (pathname === "/bgos" || pathname.startsWith("/bgos/")) return true;
  if (pathname === "/sales-booster" || pathname.startsWith("/sales-booster/")) return true;
  if (isPublicRoute(pathname)) return true;
  return false;
}

function iceAllowsPagePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  if (p === "/lead") return true;
  /** Onboarding runs on the same app; ICECONNECT host must not force login for these paths. */
  if (p === "/onboarding" || p.startsWith("/onboarding/")) return true;
  return pathname === "/iceconnect" || pathname.startsWith("/iceconnect/");
}

/** APIs that belong to the BGOS boss app host only — everything else under `/api/*` is allowed on iceconnect.in. */
const BGOS_HOST_ONLY_API_PREFIXES = [
  "/api/bgos",
  "/api/dashboard",
  "/api/activity",
  "/api/automation",
  "/api/pipeline",
  "/api/quotation",
  "/api/invoice",
  "/api/expense",
  "/api/users",
  "/api/sales-booster",
] as const;

function matchesApiPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function iceAllowsApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  for (const prefix of BGOS_HOST_ONLY_API_PREFIXES) {
    if (matchesApiPrefix(pathname, prefix)) return false;
  }
  return true;
}

function billingFunnelPagePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return (
    p === "/bgos/billing" ||
    p.startsWith("/bgos/billing/") ||
    p === "/bgos/subscription" ||
    p.startsWith("/bgos/subscription/") ||
    p === "/bgos/pricing" ||
    p.startsWith("/bgos/pricing/") ||
    p === "/sales-booster" ||
    p.startsWith("/sales-booster/")
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
  activeCompanyIdCookie: string | undefined,
): boolean {
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || !sub) return false;
  if (typeof email !== "string" || !email) return false;

  const tenant = resolveTenantFromJwt(payload, activeCompanyIdCookie);

  headers.set(AUTH_HEADER_USER_ID, sub);
  headers.set(AUTH_HEADER_USER_EMAIL, email);
  headers.set(AUTH_HEADER_USER_ROLE, tenant.jobRole);

  if (tenant.needsCompany) {
    headers.set(AUTH_HEADER_NEEDS_COMPANY, "1");
    headers.delete(AUTH_HEADER_COMPANY_ID);
    headers.set(AUTH_HEADER_COMPANY_PLAN, "BASIC");
    headers.set(AUTH_HEADER_WORKSPACE_READY, tenant.workspaceReady ? "1" : "0");
  } else {
    headers.set(AUTH_HEADER_COMPANY_ID, tenant.companyId!);
    headers.set(AUTH_HEADER_COMPANY_PLAN, tenant.companyPlan);
    if (isPlanLockedToBasic()) {
      headers.set(AUTH_HEADER_COMPANY_PLAN, "BASIC");
    }
    headers.delete(AUTH_HEADER_NEEDS_COMPANY);
    headers.set(AUTH_HEADER_WORKSPACE_READY, tenant.workspaceReady ? "1" : "0");
  }
  const jwtSuperBoss = payload.superBoss === true && isSuperBossEmail(email);
  if (jwtSuperBoss) {
    headers.set(AUTH_HEADER_SUPER_BOSS, "1");
  } else {
    headers.delete(AUTH_HEADER_SUPER_BOSS);
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const host = request.headers.get("host") || "";
  const tenant = hostTenantFromHeader(host);

  if (tenant === "bgos") {
    if (pathname.startsWith("/api")) {
      if (pathname.startsWith("/api/iceconnect")) {
        return wrongHostJson("ICECONNECT API is only available on iceconnect.in");
      }
    } else if (pathname === "/iceconnect" || pathname.startsWith("/iceconnect/")) {
      /** Same-origin BGOS host: never mount ICECONNECT workspace here (avoids boss flicker / wrong shell). */
      const dest = new URL("/bgos/dashboard", request.url);
      dest.search = request.nextUrl.search;
      return NextResponse.redirect(dest);
    } else if (!bgosAllowsPagePath(pathname)) {
      return NextResponse.redirect(new URL("/bgos/dashboard", request.url));
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
      if (isRootPath(pathname)) {
        const rootIce = new URL("/iceconnect", request.url);
        rootIce.search = request.nextUrl.search;
        return NextResponse.redirect(rootIce);
      }
      return NextResponse.redirect(new URL("/iceconnect/login", request.url));
    }
  }

  if (skipsMiddlewareAuth(pathname, method)) {
    if (pathname === "/iceconnect/login") {
      const iceToken = readToken(request);
      if (!iceToken) return NextResponse.next();
      const iceVerified = await verifyJwtEdge(iceToken);
      if (
        iceVerified.ok &&
        typeof iceVerified.payload.role === "string"
      ) {
        const p = iceVerified.payload as Record<string, unknown>;
        const em = typeof p.email === "string" ? p.email : "";
        const sb = p.superBoss === true && isSuperBossEmail(em);
        const homePath = sb ? "/bgos/dashboard" : getRoleHome(String(p.role));
        return NextResponse.redirect(absoluteRoleHomeUrl(tenant, homePath, request.url));
      }
      return NextResponse.next();
    }
    if (normalizePathname(pathname) === "/login" && tenant === "bgos") {
      const loginToken = readToken(request);
      if (loginToken) {
        const loginVerified = await verifyJwtEdge(loginToken);
        if (
          loginVerified.ok &&
          typeof loginVerified.payload.role === "string"
        ) {
          const p = loginVerified.payload as Record<string, unknown>;
          const em = typeof p.email === "string" ? p.email : "";
          const sb = p.superBoss === true && isSuperBossEmail(em);
          const homePath = sb ? "/bgos/dashboard" : getRoleHome(String(p.role));
          return NextResponse.redirect(absoluteRoleHomeUrl(tenant, homePath, request.url));
        }
      }
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
    return NextResponse.redirect(loginRedirectUrl(request, pathname, tenant));
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
    return NextResponse.redirect(loginRedirectUrl(request, pathname, tenant));
  }

  const jwtEmailEdge =
    typeof verified.payload.email === "string" ? verified.payload.email : "";
  const edgeSuperBoss =
    verified.payload.superBoss === true && isSuperBossEmail(jwtEmailEdge);
  const productionBossBypass = isBgosProductionBossBypassEmail(jwtEmailEdge);

  if (
    !tryAttachUserHeaders(
      requestHeaders,
      verified.payload,
      request.cookies.get(ACTIVE_COMPANY_COOKIE_NAME)?.value,
    )
  ) {
    if (pathname.startsWith("/api")) {
      return authErrorResponse(AUTH_ERROR_CODES.TOKEN_INVALID);
    }
    return NextResponse.redirect(loginRedirectUrl(request, pathname, tenant));
  }

  const needsCompany = requestHeaders.get(AUTH_HEADER_NEEDS_COMPANY) === "1";
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === "/api/company/create") {
    if (request.method !== "POST") {
      return NextResponse.json(
        { ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
        { status: 405 },
      );
    }
  }

  if (needsCompany) {
    const allowed =
      normalizedPath === "/onboarding" ||
      normalizedPath.startsWith("/onboarding/") ||
      normalizedPath === "/api/auth/me" ||
      normalizedPath === "/api/auth/logout" ||
      normalizedPath === "/api/company/create" ||
      (normalizedPath === "/api/company/list" && request.method === "GET") ||
      (edgeSuperBoss &&
        (normalizedPath === "/bgos/dashboard" ||
          normalizedPath === "/bgos/control" ||
          normalizedPath.startsWith("/bgos/control/"))) ||
      (edgeSuperBoss && normalizedPath.startsWith("/api/bgos/control/"));
    if (!allowed) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          {
            ok: false,
            error: "Complete company setup first",
            code: "NEEDS_ONBOARDING",
          },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  const hasCompanyContext =
    !needsCompany && Boolean(requestHeaders.get(AUTH_HEADER_COMPANY_ID));
  const awaitingWorkspaceActivation =
    hasCompanyContext && verified.payload.workspaceReady === false;

  if (awaitingWorkspaceActivation) {
    const isActivatePost =
      normalizedPath === "/api/onboarding/activate" && request.method === "POST";
    if (normalizedPath === "/api/onboarding/activate" && !isActivatePost) {
      return NextResponse.json(
        { ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
        { status: 405 },
      );
    }
    if (!isActivatePost) {
      const allowedActivation =
        normalizedPath === "/onboarding" ||
        normalizedPath.startsWith("/onboarding/") ||
        normalizedPath === "/api/auth/me" ||
        normalizedPath === "/api/auth/logout" ||
        (normalizedPath === "/api/auth/refresh-session" && request.method === "POST") ||
        (normalizedPath === "/api/company/list" && request.method === "GET") ||
        (edgeSuperBoss &&
          (normalizedPath === "/bgos/dashboard" ||
            normalizedPath === "/bgos/control" ||
            normalizedPath.startsWith("/bgos/control/"))) ||
        (edgeSuperBoss && normalizedPath.startsWith("/api/bgos/control/"));
      if (!allowedActivation) {
        if (pathname.startsWith("/api")) {
          return NextResponse.json(
            {
              ok: false,
              error: "Complete workspace activation to continue",
              code: "WORKSPACE_NOT_ACTIVATED",
            },
            { status: 403 },
          );
        }
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  const role = String(verified.payload.role);

  /** Company boss (ADMIN) must use bgos.online — not employee dashboards on iceconnect.in. */
  if (tenant === "ice" && !edgeSuperBoss && role === "ADMIN") {
    const authOnlyApi =
      normalizedPath === "/api/auth/me" ||
      normalizedPath === "/api/auth/logout" ||
      (normalizedPath === "/api/auth/refresh-session" && method === "POST");
    if (!authOnlyApi) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          {
            ok: false as const,
            error: "Boss workspace is on bgos.online",
            code: "WRONG_HOST" as const,
          },
          { status: 403 },
        );
      }
      const bossLogin = new URL("/login", publicBgosOrigin());
      bossLogin.searchParams.set("reason", "boss");
      return NextResponse.redirect(bossLogin);
    }
  }

  if (pathname === "/iceconnect" || pathname === "/iceconnect/") {
    const homePath = edgeSuperBoss ? "/bgos/dashboard" : getRoleHome(role);
    if (normalizePathname(homePath) !== normalizePathname(pathname)) {
      return NextResponse.redirect(absoluteRoleHomeUrl(tenant, homePath, request.url));
    }
  }

  if (pathname.startsWith("/api/bgos/control") && !edgeSuperBoss) {
    return NextResponse.json(
      { ok: false, error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (!pathname.startsWith("/api") && tenant === "bgos" && edgeSuperBoss && normalizedPath === "/bgos") {
    return NextResponse.redirect(new URL("/bgos/dashboard", request.url));
  }

  if (
    tenant === "ice" &&
    !pathname.startsWith("/api") &&
    edgeSuperBoss &&
    (normalizedPath === "/iceconnect" || normalizedPath.startsWith("/iceconnect/")) &&
    normalizedPath !== "/iceconnect/login" &&
    !normalizedPath.startsWith("/iceconnect/login/")
  ) {
    return NextResponse.redirect(new URL("/bgos/dashboard", publicBgosOrigin()));
  }

  if (
    normalizedPath === "/bgos/control" ||
    normalizedPath.startsWith("/bgos/control/")
  ) {
    if (!edgeSuperBoss) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          { ok: false, error: "Forbidden", code: "FORBIDDEN" },
          { status: 403 },
        );
      }
      const homePath = getRoleHome(role);
      return NextResponse.redirect(absoluteRoleHomeUrl(tenant, homePath, request.url));
    }
  }

  if (!roleCanAccessPath(role, pathname, { superBoss: edgeSuperBoss })) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
    const homePath = getRoleHome(role);
    if (normalizePathname(homePath) === normalizePathname(pathname)) {
      return NextResponse.redirect(loginRedirectUrl(request, pathname, tenant));
    }
    return NextResponse.redirect(absoluteRoleHomeUrl(tenant, homePath, request.url));
  }

  // Active company's plan (JWT membership row for activeCompanyId cookie). Not per-user.
  const companyPlanRaw = requestHeaders.get(AUTH_HEADER_COMPANY_PLAN) ?? "BASIC";
  const companyPlan = isPlanLockedToBasic() ? "BASIC" : companyPlanRaw;

  const activeCompanyCookie = request.cookies.get(ACTIVE_COMPANY_COOKIE_NAME)?.value;
  const customPaymentPendingJwt =
    hasCompanyContext &&
    !needsCompany &&
    !productionBossBypass &&
    !edgeSuperBoss &&
    jwtSaysCustomPaymentPending(verified.payload, activeCompanyCookie);

  if (customPaymentPendingJwt && tenant === "bgos" && !edgeSuperBoss) {
    if (pathname.startsWith("/api")) {
      if (!customPaymentPendingAllowsApiRequest(pathname, request.method)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Complete subscription payment to continue.",
            code: "CUSTOM_PAYMENT_REQUIRED",
          },
          { status: 403 },
        );
      }
    } else {
      const p = normalizePathname(pathname);
      const allowedPage =
        p === "/onboarding/custom" ||
        p.startsWith("/onboarding/custom/") ||
        p === "/login" ||
        p === "/signup";
      if (!allowedPage) {
        return NextResponse.redirect(new URL("/onboarding/custom/pay", request.url));
      }
    }
  }

  const subscriptionExpiredJwt =
    hasCompanyContext &&
    !needsCompany &&
    !productionBossBypass &&
    jwtSaysSubscriptionExpired(verified.payload, activeCompanyCookie);

  if (
    tenant === "bgos" &&
    !pathname.startsWith("/api") &&
    !edgeSuperBoss &&
    (normalizePathname(pathname) === "/bgos" || pathname.startsWith("/bgos/")) &&
    subscriptionExpiredJwt &&
    !billingFunnelPagePath(pathname)
  ) {
    return NextResponse.redirect(new URL("/bgos/billing", request.url));
  }

  if (
    pathname.startsWith("/api") &&
    !edgeSuperBoss &&
    !productionBossBypass &&
    subscriptionExpiredJwt &&
    !trialExpiredAllowsApiRequest(normalizedPath, method)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: TRIAL_EXPIRED_API_MESSAGE,
        code: "TRIAL_EXPIRED",
      },
      { status: 403 },
    );
  }

  // See `pathnameRequiresProPlan` — automation + sales-booster (except upgrade allowlist).
  const planTier = jwtCompanyPlanFromUnknown(companyPlan);
  if (
    pathname.startsWith("/api") &&
    !edgeSuperBoss &&
    !productionBossBypass &&
    pathnameRequiresProPlan(pathname) &&
    !jwtPlanIsProPlus(planTier)
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
