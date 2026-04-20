/**
 * Lightweight JSON smoke: public/unauthenticated GETs + optional MF apply POST body validation.
 * Run: npm run e2e:smoke (with E2E_BASE_URL, server up). Expects 401/403 JSON for protected routes without cookies.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { e2eFetch, waitForDevServer } from "./e2e-fetch.mjs";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
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

const cases = [
  { name: "auth/me (no cookie)", path: "/api/auth/me", method: "GET", expectStatuses: [200] },
  {
    name: "control/clients (no cookie)",
    path: "/api/bgos/control/clients",
    method: "GET",
    expectStatuses: [401, 403],
  },
  {
    name: "control/team (no cookie)",
    path: "/api/bgos/control/team",
    method: "GET",
    expectStatuses: [401, 403],
  },
  {
    name: "micro-franchise/partner/me (no cookie)",
    path: "/api/micro-franchise/partner/me",
    method: "GET",
    expectStatuses: [401, 403],
  },
  {
    name: "micro-franchise/apply (empty body)",
    path: "/api/micro-franchise/apply",
    method: "POST",
    body: {},
    expectStatuses: [400, 401, 403],
  },
];

async function run() {
  await waitForDevServer(BASE);
  let failed = 0;
  for (const c of cases) {
    const res = await e2eFetch(`${BASE}${c.path}`, {
      method: c.method,
      headers: c.body !== undefined ? { "Content-Type": "application/json" } : {},
      body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = null;
    }
    const okBody = json !== null && typeof json === "object";
    const statusOk = c.expectStatuses.includes(res.status);
    if (statusOk && okBody) {
      console.log(`PASS: ${c.name} (${res.status})`);
    } else {
      failed += 1;
      console.log(`FAIL: ${c.name} status=${res.status} json=${okBody}`, text.slice(0, 200));
    }
  }

  {
    const res = await e2eFetch(`${BASE}/api/onboarding/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "x", industry: "SOLAR" }),
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = null;
    }
    if ([401, 403].includes(res.status) && json && typeof json === "object") {
      console.log(`PASS: onboarding/launch unauth (${res.status})`);
    } else {
      failed += 1;
      console.log(`FAIL: onboarding/launch unauth`, res.status, text.slice(0, 200));
    }
  }

  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
