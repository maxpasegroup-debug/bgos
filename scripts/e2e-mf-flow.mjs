/**
 * MF apply → boss activate-mou → new owner onboarding/launch with referralPhone → partner/me → optional commission accrual (tsx).
 *
 * Prereq: dev server, DATABASE_URL, JWT_SECRET, BGOS_BOSS_EMAIL user exists, E2E_BOSS_PASSWORD for that user,
 * commission plan in DB (migration micro_franchise). Env: E2E_BASE_URL (default http://localhost:3000).
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
const bossEmail = (process.env.BGOS_BOSS_EMAIL || "").trim().toLowerCase();
const bossPassword = (process.env.E2E_BOSS_PASSWORD || "").trim();

function mergeCookieJar(prev, res) {
  const cookies = new Map();
  const parsePart = (part) => {
    const i = part.indexOf("=");
    if (i > 0) cookies.set(part.slice(0, i), part.slice(i + 1));
  };
  if (prev) {
    for (const c of prev.split(/;\s*/)) {
      if (c) parsePart(c);
    }
  }
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of list) {
    const first = line.split(";")[0];
    if (first) parsePart(first);
  }
  if (list.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) {
      for (const seg of single.split(/,(?=[^;]+?=)/)) {
        const first = seg.trim().split(";")[0];
        if (first) parsePart(first);
      }
    }
  }
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, { method = "GET", jar = "", body, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (jar) h.cookie = jar;
  const res = await e2eFetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _parseError: true, _raw: text?.slice?.(0, 400) };
  }
  return { res, json };
}

function fail(step, msg, extra) {
  console.error(`FAIL [${step}]: ${msg}`);
  if (extra != null) console.error(JSON.stringify(extra, null, 2));
  process.exit(1);
}

async function main() {
  await waitForDevServer(BASE);
  if (!bossEmail) fail("config", "Set BGOS_BOSS_EMAIL in .env");
  if (!bossPassword) fail("config", "Set E2E_BOSS_PASSWORD to the platform boss account password");

  const t = Date.now();
  const partnerPhone = `9${String(t).slice(-9)}`.padEnd(10, "0").slice(0, 10);
  const ownerEmail = `e2e-mf-owner-${t}@example.com`;
  const ownerPassword = "e2e-test-pass-8chars";

  let applicationId = "";

  {
    const { res, json } = await req("/api/micro-franchise/apply", {
      method: "POST",
      body: {
        name: `E2E MF ${t}`,
        phone: `+91 ${partnerPhone.slice(0, 5)} ${partnerPhone.slice(5)}`,
        email: `e2e-mf-app-${t}@example.com`,
      },
    });
    if (!res.ok || !json.ok) fail("apply", `HTTP ${res.status}`, json);
    applicationId = json.applicationId;
    if (!applicationId) fail("apply", "missing applicationId", json);
    console.log("PASS: apply", applicationId);
  }

  let bossJar = "";
  {
    const { res, json } = await req("/api/auth/login", {
      method: "POST",
      body: { email: bossEmail, password: bossPassword, respondWithJson: true },
    });
    if (!res.ok || !json.ok) fail("boss login", `HTTP ${res.status}`, json);
    bossJar = mergeCookieJar("", res);
    if (!bossJar.includes("token=")) fail("boss login", "no session cookie");
    console.log("PASS: boss login");
  }

  let partnerId = "";
  let mfPassword = "";
  let mfEmail = "";
  {
    const { res, json } = await req(`/api/bgos/control/micro-franchise/applications/${applicationId}/activate-mou`, {
      method: "POST",
      jar: bossJar,
    });
    if (!res.ok || !json.ok) fail("activate-mou", `HTTP ${res.status}`, json);
    partnerId = json.partnerId;
    mfPassword = json.temporaryPassword || "";
    mfEmail = json.loginEmail || "";
    if (!partnerId) fail("activate-mou", "missing partnerId", json);
    console.log("PASS: activate-mou", partnerId);
  }

  let ownerJar = "";
  {
    const { res, json } = await req("/api/auth/signup", {
      method: "POST",
      body: { name: "E2E MF Owner", email: ownerEmail, password: ownerPassword },
    });
    if (!res.ok || !json.ok) fail("signup owner", `HTTP ${res.status}`, json);
    ownerJar = mergeCookieJar("", res);
    if (!ownerJar.includes("token=")) fail("signup owner", "no cookie");
    console.log("PASS: signup owner");
  }

  let companyId = "";
  {
    const { res, json } = await req("/api/onboarding/launch", {
      method: "POST",
      jar: ownerJar,
      body: {
        companyName: `E2E MF Co ${t}`,
        industry: "SOLAR",
        referralPhone: partnerPhone,
      },
    });
    if (!res.ok || !json.ok) fail("onboarding/launch", `HTTP ${res.status}`, json);
    companyId = json.companyId;
    if (!companyId) fail("onboarding/launch", "missing companyId", json);
    ownerJar = mergeCookieJar(ownerJar, res);
    console.log("PASS: onboarding/launch", companyId);
  }

  let mfJar = "";
  {
    if (!mfEmail || !mfPassword) {
      console.warn("SKIP: partner login (no temporaryPassword in response — idempotent activation?)");
    } else {
      const { res, json } = await req("/api/auth/login", {
        method: "POST",
        body: { email: mfEmail, password: mfPassword, respondWithJson: true },
      });
      if (!res.ok || !json.ok) fail("mf login", `HTTP ${res.status}`, json);
      mfJar = mergeCookieJar("", res);
      if (!mfJar.includes("token=")) fail("mf login", "no cookie");
      console.log("PASS: mf partner login");
    }
  }

  if (mfJar) {
    const { res, json } = await req("/api/micro-franchise/partner/me", { jar: mfJar });
    if (!res.ok || !json.ok) fail("partner/me", `HTTP ${res.status}`, json);
    const w = json.partner?.wallet;
    if (!w) fail("partner/me", "missing wallet", json);
    console.log("PASS: partner/me wallet pending=", w.pending);
  }

  {
    const paymentRef = `e2e-mf-pay-${t}`;
    const { res, json } = await req("/api/dev/trigger-commission", {
      method: "POST",
      jar: bossJar,
      body: { companyId, amount: 10000, paymentRef },
    });
    if (!res.ok || !json.ok) fail("commission trigger", `HTTP ${res.status}`, json);
    if (!json.transaction?.id) fail("commission trigger", "missing transaction", json);
    if (typeof json.wallet?.pending !== "number" || json.wallet.pending <= 0) {
      fail("commission trigger", "wallet not incremented", json);
    }
    console.log("PASS: commission trigger", json.transaction.id, "pending=", json.wallet.pending);
  }

  if (mfJar) {
    const { res, json } = await req("/api/micro-franchise/partner/me", { jar: mfJar });
    if (!res.ok || !json.ok) fail("partner/me after commission", `HTTP ${res.status}`, json);
    const pending = Number(json.partner?.wallet?.pending ?? 0);
    if (!(pending > 0)) fail("partner/me after commission", "wallet pending not updated", json);
    console.log("PASS: partner/me after commission pending=", pending);
  }

  console.log("PASS: full MF e2e flow");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
