/**
 * Auth smoke tests (scenarios 1, 2, 4, 5).
 *
 * Run:
 *   node scripts/smoke-auth.mjs
 *
 * Env:
 *   E2E_BASE_URL (default http://localhost:3000)
 *   E2E_SMOKE_EMAIL / E2E_SMOKE_PASSWORD
 *   (fallbacks: BGOS_BOSS_EMAIL / E2E_BOSS_PASSWORD)
 *   JWT_SECRET (only needed to mint scenario-2 old-shape token)
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import jwt from "jsonwebtoken";
import { e2eFetch, waitForDevServer } from "./e2e-fetch.mjs";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx < 1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) process.env[key] = val;
  }
}

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const EMAIL = (process.env.E2E_SMOKE_EMAIL || process.env.BGOS_BOSS_EMAIL || "").trim();
const PASSWORD = (process.env.E2E_SMOKE_PASSWORD || process.env.E2E_BOSS_PASSWORD || "").trim();

function parseSetCookieLines(res) {
  const direct =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (direct.length > 0) return direct;
  const single = res.headers.get("set-cookie");
  if (!single) return [];
  return single.split(/,(?=[^;]+?=)/).map((s) => s.trim());
}

function mergeCookieJar(prev, res) {
  const cookies = new Map();
  const parsePart = (part) => {
    const i = part.indexOf("=");
    if (i <= 0) return;
    cookies.set(part.slice(0, i), part.slice(i + 1));
  };

  if (prev) {
    for (const c of prev.split(/;\s*/)) {
      if (c) parsePart(c);
    }
  }

  for (const line of parseSetCookieLines(res)) {
    const first = line.split(";")[0];
    if (first) parsePart(first);
  }

  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(urlPath, { method = "GET", jar = "", body, redirect = "follow" } = {}) {
  const headers = { ...(body ? { "Content-Type": "application/json" } : {}) };
  if (jar) headers.cookie = jar;
  const res = await e2eFetch(`${BASE}${urlPath}`, {
    method,
    redirect,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

function expectedDashboardPath(user) {
  const role = user?.role;
  const employeeDomain = user?.employeeDomain;
  if ((role === "BOSS" || role === "ADMIN") && employeeDomain === "SOLAR") {
    return "/solar/dashboard";
  }
  return "/dashboard";
}

function hasNormalizedUserShape(user) {
  return (
    user &&
    typeof user.sub === "string" &&
    user.sub.length > 0 &&
    typeof user.email === "string" &&
    user.email.length > 0 &&
    typeof user.role === "string" &&
    typeof user.workspaceReady === "boolean" &&
    (typeof user.companyId === "string" || user.companyId === null) &&
    typeof user.companyPlan === "string"
  );
}

function pass(name, extra = "") {
  console.log(`PASS: ${name}${extra ? ` — ${extra}` : ""}`);
}

function fail(name, message, extra = "") {
  console.log(`FAIL: ${name} — ${message}${extra ? ` (${extra})` : ""}`);
  process.exitCode = 1;
}

async function scenario1FreshLogin() {
  const name = "Scenario 1 (Fresh login)";
  const login = await req("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD, respondWithJson: true },
  });
  if (!login.res.ok) {
    fail(name, `login failed`, `status=${login.res.status}`);
    return "";
  }
  const jar = mergeCookieJar("", login.res);
  if (!jar.includes("token=")) {
    fail(name, "token cookie missing after login");
    return "";
  }

  const me = await req("/api/auth/me", { jar });
  if (!me.res.ok || !me.json?.user || !hasNormalizedUserShape(me.json.user)) {
    fail(name, "normalized /api/auth/me user shape invalid");
    return "";
  }

  const dashPath = expectedDashboardPath(me.json.user);
  const dash = await req(dashPath, { jar, redirect: "manual" });
  const location = dash.res.headers.get("location") ?? "";
  if (dash.res.status >= 300 && dash.res.status < 400 && location.includes("/login")) {
    fail(name, "redirected to /login unexpectedly", `status=${dash.res.status}`);
    return "";
  }

  pass(name, `dashboard=${dashPath}`);
  return jar;
}

async function scenario2OldSessionRedirect() {
  const name = "Scenario 2 (Old session handling)";
  const secret = (process.env.JWT_SECRET || "").trim();
  if (!secret || secret.length < 32) {
    fail(name, "JWT_SECRET missing/weak; cannot mint old-session token");
    return;
  }

  const oldToken = jwt.sign(
    { userId: "legacy-user", role: "ADMIN", companyType: "BGOS" },
    secret,
    { expiresIn: "7d" },
  );
  const oldJar = `token=${oldToken}`;

  const me = await req("/api/auth/me", { jar: oldJar });
  if (!me.res.ok || me.json?.requiresRelogin !== true) {
    fail(name, "old cookie did not trigger requiresRelogin");
    return;
  }

  const protectedRes = await req("/dashboard", { jar: oldJar, redirect: "manual" });
  const location = protectedRes.res.headers.get("location") ?? "";
  if (!(protectedRes.res.status >= 300 && protectedRes.res.status < 400 && location.includes("/login"))) {
    fail(name, "protected page did not redirect to /login", `status=${protectedRes.res.status}`);
    return;
  }

  pass(name);
}

async function scenario4Logout(initialJar) {
  const name = "Scenario 4 (Logout clears auth cookies)";
  if (!initialJar || !initialJar.includes("token=")) {
    fail(name, "missing authenticated jar");
    return;
  }

  const logout = await req("/api/auth/logout", { method: "POST", jar: initialJar });
  if (!logout.res.ok) {
    fail(name, "logout API failed", `status=${logout.res.status}`);
    return;
  }
  const setCookieLines = parseSetCookieLines(logout.res).join("\n");
  const expects = ["token=", "activeCompanyId=", "bgos_onboarding_sid="];
  const missing = expects.filter((c) => !setCookieLines.includes(c));
  if (missing.length > 0) {
    fail(name, "missing clear Set-Cookie headers", missing.join(", "));
    return;
  }

  const loggedOutJar = mergeCookieJar(initialJar, logout.res);
  const me = await req("/api/auth/me", { jar: loggedOutJar });
  if (!me.res.ok || me.json?.user !== null) {
    fail(name, "/api/auth/me should be logged out");
    return;
  }

  const protectedRes = await req("/dashboard", { jar: loggedOutJar, redirect: "manual" });
  const location = protectedRes.res.headers.get("location") ?? "";
  if (!(protectedRes.res.status >= 300 && protectedRes.res.status < 400 && location.includes("/login"))) {
    fail(name, "post-logout /dashboard did not redirect to /login", `status=${protectedRes.res.status}`);
    return;
  }

  pass(name);
}

async function scenario5InvalidCredentials() {
  const name = "Scenario 5 (Invalid credentials)";
  const bad = await req("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: `${PASSWORD}__wrong` },
  });
  if (bad.res.status !== 401) {
    fail(name, "expected 401 for wrong password", `status=${bad.res.status}`);
    return;
  }
  const setCookieLines = parseSetCookieLines(bad.res).join("\n");
  if (setCookieLines.includes("token=")) {
    fail(name, "token cookie should not be set on invalid login");
    return;
  }
  pass(name);
}

async function main() {
  loadDotEnv();
  if (!EMAIL || !PASSWORD) {
    console.error(
      "FAIL: config — set E2E_SMOKE_EMAIL/E2E_SMOKE_PASSWORD (or BGOS_BOSS_EMAIL/E2E_BOSS_PASSWORD)",
    );
    process.exit(1);
  }

  await waitForDevServer(BASE);

  const jar = await scenario1FreshLogin();
  await scenario2OldSessionRedirect();
  await scenario4Logout(jar);
  await scenario5InvalidCredentials();

  if (process.exitCode && process.exitCode !== 0) {
    console.log("FAIL: smoke-auth failed");
    process.exit(1);
  }
  console.log("PASS: smoke-auth complete");
}

main().catch((e) => {
  console.error(`FAIL: unhandled error — ${e?.message ?? String(e)}`);
  process.exit(1);
});

