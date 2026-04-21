import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  companyPlanFromJwtClaim,
  pathnameRequiresProPlan,
} from "@/lib/auth-config";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import {
  SUPER_BOSS_HOME_PATH,
  getRoleHome,
  roleCanAccessPath,
} from "@/lib/role-routing";

/** External callbacks without browser cookies — must stay reachable without session. */
const WEBHOOK_PREFIXES = ["/api/payment/webhook", "/api/payment/razorpay/webhook"] as const;

function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type CookieSessionClaims = {
  role?: unknown;
  companyPlan?: unknown;
  superBoss?: unknown;
};

async function verifyCookieJwt(token: string): Promise<CookieSessionClaims | null> {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return payload as CookieSessionClaims;
  } catch {
    return null;
  }
}

/** Explicit page rules requested by product/security. */
function passesExplicitPageRules(pathname: string, role: string): boolean | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    // Any authenticated role.
    return true;
  }
  if (pathname === "/solar-boss" || pathname.startsWith("/solar-boss/")) {
    return role === "ADMIN";
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

export function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
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
      return unauthorizedApi();
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return (async () => {
    // Edge-safe JWT verification (jose), no server-only imports.
    const claims = await verifyCookieJwt(token);
    if (!claims) {
      if (pathname.startsWith("/api")) {
        return unauthorizedApi();
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = typeof claims.role === "string" ? claims.role : "";
    const superBoss = claims.superBoss === true;

    if (!role) {
      if (pathname.startsWith("/api")) {
        return unauthorizedApi();
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Explicit rules first (/dashboard, /solar/*, /solar-boss/*).
    const explicit = passesExplicitPageRules(pathname, role);
    if (explicit === false) {
      if (pathname.startsWith("/api")) {
        return forbiddenApi();
      }
      const home = superBoss ? SUPER_BOSS_HOME_PATH : getRoleHome(role);
      return NextResponse.redirect(new URL(home, req.url));
    }

    // Role gating from existing source of truth.
    if (!roleCanAccessPath(role, pathname, { superBoss })) {
      if (pathname.startsWith("/api")) {
        return forbiddenApi();
      }
      const home = superBoss ? SUPER_BOSS_HOME_PATH : getRoleHome(role);
      return NextResponse.redirect(new URL(home, req.url));
    }

    // Plan gating (PRO means PRO/ENTERPRISE pass, BASIC fails).
    if (pathnameRequiresProPlan(pathname)) {
      const effectivePlan = effectivePlanFromClaims(claims);
      const hasPro = effectivePlan === "PRO" || effectivePlan === "ENTERPRISE";
      if (!hasPro) {
        if (pathname.startsWith("/api")) {
          return forbiddenApi("Upgrade required");
        }
        return NextResponse.redirect(new URL("/bgos/subscription", req.url));
      }
    }

    return NextResponse.next();
  })();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
